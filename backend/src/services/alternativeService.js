import {
  findNearbySlots,
  rankVenueSuggestions,
} from "../domain/alternatives.js";
import { validateBooking } from "../domain/bookingRules.js";
import { fromTaipei } from "../../../shared/src/taipei.js";
import { findOccupiedVenueIds } from "../repositories/slotRepository.js";
import * as venueRepository from "../repositories/venueRepository.js";
import { loadDayOccupied, slotStartsFor } from "./slotService.js";

/**
 * 同時段其他可用場地（FR-010～FR-013、FR-018）：排除目前場地，只列啟用中、
 * 所選日期與起訖完全落在開放時段內、容納人數足夠、該時段沒有占用的場地。
 * 不比對設備與地點；批次查詢占用，不逐場地查詢（NFR-001）。
 */
async function findAvailableVenues(conn, { venue, input, rules, current }) {
  const active = await venueRepository.listActive(conn);
  const candidates = active.filter(
    (item) => Number(item.id) !== Number(venue.id),
  );
  const passing = candidates.filter(
    (candidate) =>
      validateBooking(
        {
          venue: candidate,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          attendees: input.attendees,
          subject: "建議",
        },
        rules,
        current,
      ).filter((item) => item.rule !== "status").length === 0,
  );
  if (!passing.length) {
    return [];
  }
  const slotStarts = slotStartsFor(
    fromTaipei(input.date, input.startTime),
    fromTaipei(input.date, input.endTime),
  );
  const occupied = await findOccupiedVenueIds(
    conn,
    passing.map((item) => Number(item.id)),
    slotStarts,
  );
  const free = passing.filter((item) => !occupied.has(Number(item.id)));
  return rankVenueSuggestions(free);
}

/**
 * 組裝「撞時段」時的替代建議（UI-01、UI-02）。
 * 只做唯讀計算，不保留時段、不寫入資料（R-06）。
 * venues 由使用者故事 2 補上，本階段固定為空陣列。
 *
 * @param {object} conn 交易連線
 * @param {object} args
 * @param {object} args.venue 被拒絕的場地
 * @param {{date: string, startTime: string, endTime: string, attendees: number}} args.input 所選時段與人數
 * @param {object} args.rules 規則值快照
 * @param {Date} args.current 現在時間
 * @param {object | null} [args.excludeWindow] 修改預約時自己的原時段（場地未改時）
 * @param {{type: string, id: number} | null} [args.excludeHolder] 併發重算時排除的占用者
 */
export async function buildSuggestions(
  conn,
  { venue, input, rules, current, excludeWindow = null, excludeHolder = null },
) {
  const occupiedStarts = await loadDayOccupied(conn, venue.id, input.date, {
    excludeHolder,
  });
  const { slots, noSlotsToday } = findNearbySlots({
    venue,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    attendees: input.attendees,
    rules,
    current,
    occupiedStarts,
    excludeWindow,
  });
  const venues = await findAvailableVenues(conn, {
    venue,
    input,
    rules,
    current,
  });
  return { slots, noSlotsToday, venues };
}
