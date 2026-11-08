// 場地選單的收藏分組（research.md R-04；ui-contract.md › UI-02 › 狀態）。
// 收藏標記由後端 GET /api/venues 提供；回應省略 isFavorite（收藏載入失敗）時退回不分組。
export function groupVenues(venues) {
  const favoritesUnavailable =
    venues.length > 0 && venues.every((venue) => !("isFavorite" in venue));
  if (favoritesUnavailable) {
    return { favorites: [], others: venues, favoritesUnavailable: true };
  }
  const favorites = venues
    .filter((venue) => venue.isFavorite === true)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  const others = venues.filter((venue) => venue.isFavorite !== true);
  return { favorites, others, favoritesUnavailable: false };
}
