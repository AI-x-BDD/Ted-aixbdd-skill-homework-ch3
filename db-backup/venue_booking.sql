-- MySQL dump 10.13  Distrib 8.4.13, for Linux (x86_64)
--
-- Host: localhost    Database: venue_booking
-- ------------------------------------------------------
-- Server version	8.4.13

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `venue_booking`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `venue_booking` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `venue_booking`;

--
-- Table structure for table `booking_events`
--

DROP TABLE IF EXISTS `booking_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `booking_id` bigint NOT NULL,
  `actor_user_id` bigint DEFAULT NULL,
  `actor_type` varchar(16) NOT NULL,
  `occurred_at` datetime(3) NOT NULL,
  `from_status` varchar(16) DEFAULT NULL,
  `to_status` varchar(16) NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_booking_events_booking` (`booking_id`,`occurred_at`,`id`),
  KEY `fk_booking_events_actor_user_id` (`actor_user_id`),
  CONSTRAINT `fk_booking_events_actor_user_id` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_booking_events_booking_id` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `chk_events_actor_type` CHECK ((`actor_type` in (_utf8mb4'user',_utf8mb4'reviewer',_utf8mb4'admin',_utf8mb4'system'))),
  CONSTRAINT `chk_events_from_status` CHECK (((`from_status` is null) or (`from_status` in (_utf8mb4'pending',_utf8mb4'confirmed',_utf8mb4'checked_in',_utf8mb4'completed',_utf8mb4'rejected',_utf8mb4'cancelled',_utf8mb4'no_show')))),
  CONSTRAINT `chk_events_to_status` CHECK ((`to_status` in (_utf8mb4'pending',_utf8mb4'confirmed',_utf8mb4'checked_in',_utf8mb4'completed',_utf8mb4'rejected',_utf8mb4'cancelled',_utf8mb4'no_show')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking_events`
--

LOCK TABLES `booking_events` WRITE;
/*!40000 ALTER TABLE `booking_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `booking_events` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_booking_events_no_update` BEFORE UPDATE ON `booking_events` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '紀錄不可修改' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_booking_events_no_delete` BEFORE DELETE ON `booking_events` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '紀錄不可修改' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `booking_series`
--

DROP TABLE IF EXISTS `booking_series`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking_series` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `venue_id` bigint NOT NULL,
  `frequency` varchar(16) NOT NULL,
  `first_date` date NOT NULL,
  `last_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `subject` varchar(100) NOT NULL,
  `attendees` int NOT NULL,
  `status` varchar(16) NOT NULL DEFAULT 'pending',
  `session_count` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `fk_series_user_id` (`user_id`),
  KEY `fk_series_venue_id` (`venue_id`),
  CONSTRAINT `fk_series_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_series_venue_id` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  CONSTRAINT `chk_series_frequency` CHECK ((`frequency` in (_utf8mb4'weekly',_utf8mb4'biweekly'))),
  CONSTRAINT `chk_series_status` CHECK ((`status` in (_utf8mb4'pending',_utf8mb4'confirmed',_utf8mb4'rejected',_utf8mb4'cancelled')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking_series`
--

LOCK TABLES `booking_series` WRITE;
/*!40000 ALTER TABLE `booking_series` DISABLE KEYS */;
/*!40000 ALTER TABLE `booking_series` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `booking_slots`
--

DROP TABLE IF EXISTS `booking_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `booking_slots` (
  `venue_id` bigint NOT NULL,
  `slot_start_at` datetime(3) NOT NULL,
  `holder_type` varchar(16) NOT NULL,
  `holder_id` bigint NOT NULL,
  PRIMARY KEY (`venue_id`,`slot_start_at`),
  KEY `ix_booking_slots_holder` (`holder_type`,`holder_id`),
  KEY `ix_booking_slots_slot_start_at` (`slot_start_at`),
  CONSTRAINT `fk_booking_slots_venue_id` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  CONSTRAINT `chk_slots_alignment` CHECK (((minute(`slot_start_at`) in (0,30)) and (second(`slot_start_at`) = 0) and (microsecond(`slot_start_at`) = 0))),
  CONSTRAINT `chk_slots_holder_type` CHECK ((`holder_type` in (_utf8mb4'booking',_utf8mb4'hold',_utf8mb4'maintenance')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `booking_slots`
--

LOCK TABLES `booking_slots` WRITE;
/*!40000 ALTER TABLE `booking_slots` DISABLE KEYS */;
/*!40000 ALTER TABLE `booking_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `venue_id` bigint NOT NULL,
  `start_at` datetime(3) NOT NULL,
  `end_at` datetime(3) NOT NULL,
  `subject` varchar(100) NOT NULL,
  `attendees` int NOT NULL,
  `status` varchar(16) NOT NULL,
  `series_id` bigint DEFAULT NULL,
  `series_index` int DEFAULT NULL,
  `late_cancel` tinyint NOT NULL DEFAULT '0',
  `confirmed_at` datetime(3) DEFAULT NULL,
  `reminder_sent_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bookings_series_index` (`series_id`,`series_index`),
  KEY `ix_bookings_user_status_start` (`user_id`,`status`,`start_at`),
  KEY `ix_bookings_venue_start_status` (`venue_id`,`start_at`,`status`),
  KEY `ix_bookings_status_start` (`status`,`start_at`),
  KEY `ix_bookings_start` (`start_at`),
  CONSTRAINT `fk_bookings_series_id` FOREIGN KEY (`series_id`) REFERENCES `booking_series` (`id`),
  CONSTRAINT `fk_bookings_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_bookings_venue_id` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  CONSTRAINT `chk_bookings_attendees` CHECK ((`attendees` >= 1)),
  CONSTRAINT `chk_bookings_range` CHECK ((`end_at` > `start_at`)),
  CONSTRAINT `chk_bookings_status` CHECK ((`status` in (_utf8mb4'pending',_utf8mb4'confirmed',_utf8mb4'checked_in',_utf8mb4'completed',_utf8mb4'rejected',_utf8mb4'cancelled',_utf8mb4'no_show')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `type` varchar(24) NOT NULL,
  `message` varchar(1000) NOT NULL,
  `booking_id` bigint DEFAULT NULL,
  `waitlist_entry_id` bigint DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read_at` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_notifications_user_created` (`user_id`,`created_at`,`id`),
  KEY `ix_notifications_user_read` (`user_id`,`read_at`),
  KEY `fk_notifications_booking_id` (`booking_id`),
  KEY `fk_notifications_waitlist_entry_id` (`waitlist_entry_id`),
  CONSTRAINT `fk_notifications_booking_id` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `fk_notifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_notifications_waitlist_entry_id` FOREIGN KEY (`waitlist_entry_id`) REFERENCES `waitlist_entries` (`id`),
  CONSTRAINT `chk_notifications_type` CHECK ((`type` in (_utf8mb4'booking_created',_utf8mb4'review_result',_utf8mb4'waitlist_offer',_utf8mb4'booking_cancelled',_utf8mb4'review_pending',_utf8mb4'booking_changed',_utf8mb4'suspension',_utf8mb4'waitlist_expired',_utf8mb4'reminder')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rule_changes`
--

DROP TABLE IF EXISTS `rule_changes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rule_changes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `rule_key` varchar(40) NOT NULL,
  `actor_user_id` bigint NOT NULL,
  `changed_at` datetime(3) NOT NULL,
  `old_value` int NOT NULL,
  `new_value` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_rule_changes_changed` (`changed_at`,`id`),
  KEY `fk_rule_changes_rule_key` (`rule_key`),
  KEY `fk_rule_changes_actor_user_id` (`actor_user_id`),
  CONSTRAINT `fk_rule_changes_actor_user_id` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_rule_changes_rule_key` FOREIGN KEY (`rule_key`) REFERENCES `rules` (`rule_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rule_changes`
--

LOCK TABLES `rule_changes` WRITE;
/*!40000 ALTER TABLE `rule_changes` DISABLE KEYS */;
/*!40000 ALTER TABLE `rule_changes` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`venue`@`%`*/ /*!50003 TRIGGER `trg_rule_changes_no_update` BEFORE UPDATE ON `rule_changes` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '紀錄不可修改' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`venue`@`%`*/ /*!50003 TRIGGER `trg_rule_changes_no_delete` BEFORE DELETE ON `rule_changes` FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '紀錄不可修改' */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `rules`
--

DROP TABLE IF EXISTS `rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rules` (
  `rule_key` varchar(40) NOT NULL,
  `int_value` int NOT NULL,
  `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` bigint DEFAULT NULL,
  PRIMARY KEY (`rule_key`),
  KEY `fk_rules_updated_by` (`updated_by`),
  CONSTRAINT `fk_rules_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_rules_int_value` CHECK ((`int_value` >= 1)),
  CONSTRAINT `chk_rules_key` CHECK ((`rule_key` in (_utf8mb4'max_duration_minutes',_utf8mb4'max_advance_days',_utf8mb4'max_active_bookings',_utf8mb4'max_active_series',_utf8mb4'max_series_months',_utf8mb4'late_cancel_minutes',_utf8mb4'waitlist_confirm_minutes',_utf8mb4'waitlist_cutoff_minutes',_utf8mb4'checkin_open_minutes',_utf8mb4'checkin_close_minutes',_utf8mb4'no_show_window_days',_utf8mb4'no_show_threshold',_utf8mb4'suspend_days',_utf8mb4'reminder_minutes')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rules`
--

LOCK TABLES `rules` WRITE;
/*!40000 ALTER TABLE `rules` DISABLE KEYS */;
INSERT INTO `rules` VALUES ('checkin_close_minutes',15,'2026-11-07 06:59:04.240',NULL),('checkin_open_minutes',10,'2026-11-07 06:59:04.240',NULL),('late_cancel_minutes',60,'2026-11-07 06:59:04.240',NULL),('max_active_bookings',5,'2026-11-07 06:59:04.240',NULL),('max_active_series',2,'2026-11-07 06:59:04.240',NULL),('max_advance_days',30,'2026-11-07 06:59:04.240',NULL),('max_duration_minutes',240,'2026-11-07 06:59:04.240',NULL),('max_series_months',3,'2026-11-07 06:59:04.240',NULL),('no_show_threshold',3,'2026-11-07 06:59:04.240',NULL),('no_show_window_days',30,'2026-11-07 06:59:04.240',NULL),('reminder_minutes',30,'2026-11-07 06:59:04.240',NULL),('suspend_days',7,'2026-11-07 06:59:04.240',NULL),('waitlist_confirm_minutes',30,'2026-11-07 06:59:04.240',NULL),('waitlist_cutoff_minutes',60,'2026-11-07 06:59:04.240',NULL);
/*!40000 ALTER TABLE `rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `filename` varchar(255) NOT NULL,
  PRIMARY KEY (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schema_migrations`
--

LOCK TABLES `schema_migrations` WRITE;
/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` VALUES ('001_foundation.sql'),('002_venues.sql'),('003_bookings.sql'),('004_notifications.sql'),('005_waitlist.sql'),('006_maintenance.sql'),('007_rule_changes.sql');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `token_hash` char(64) NOT NULL,
  `user_id` bigint NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sessions_token_hash` (`token_hash`),
  KEY `ix_sessions_user` (`user_id`),
  CONSTRAINT `fk_sessions_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES (1,'4f1c350d62d66f7598aebf9afd2dd67570034f5b730ae22048f84ad8479592e3',2,'2026-11-07 19:14:02.529');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `user_id` bigint NOT NULL,
  `role` varchar(16) NOT NULL,
  PRIMARY KEY (`user_id`,`role`),
  CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_user_roles_role` CHECK ((`role` in (_utf8mb4'reviewer',_utf8mb4'admin')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,'admin'),(3,'reviewer');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `name` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `is_active` tinyint NOT NULL DEFAULT '1',
  `must_change_password` tinyint NOT NULL DEFAULT '0',
  `suspended_until_at` datetime(3) DEFAULT NULL,
  `no_show_counted_from_at` datetime(3) DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin@example.com','系統管理員','scrypt$131072$8$1$mGXds_5C7nyIri5HYGjPXw$FPbjne-LMeP5_iD8Lhvggsr_D5IhQtZZwTLgRZflHLjv7bh6BUlJQ36UF9RmBV6a0QbZwvCHAeXHbUTy1NbbGQ',1,0,NULL,NULL,'2026-11-07 06:59:05.450'),(2,'user@example.com','測試使用者','scrypt$131072$8$1$sSJqwmGHHZDfHy_zKdGXiQ$xdbag6TFsvFYhp375rsIF_86NByPqkFag5U7hxDl3lyZLier6aqrdcENgMHUobVKBlv4h-hF9TwGjEcQtiPvOg',1,0,NULL,NULL,'2026-11-07 07:06:11.226'),(3,'reviewer@example.com','測試審核者','scrypt$131072$8$1$3zmC6PqIYIJiBRPKWD8vZg$5kiKdB_c0TUuYmGdwjB2taiTnJwnCklXq5Bw6J5aqPa5YestQYWR0aYw-MsVBnRSw_yLaS2m0YlOhBKa7zBNZw',1,0,NULL,NULL,'2026-11-07 07:06:11.563');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venue_maintenance_windows`
--

DROP TABLE IF EXISTS `venue_maintenance_windows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venue_maintenance_windows` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `venue_id` bigint NOT NULL,
  `start_at` datetime(3) NOT NULL,
  `end_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_maintenance_venue_start` (`venue_id`,`start_at`),
  CONSTRAINT `fk_maintenance_venue_id` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  CONSTRAINT `chk_maintenance_range` CHECK ((`end_at` > `start_at`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venue_maintenance_windows`
--

LOCK TABLES `venue_maintenance_windows` WRITE;
/*!40000 ALTER TABLE `venue_maintenance_windows` DISABLE KEYS */;
/*!40000 ALTER TABLE `venue_maintenance_windows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venue_opening_hours`
--

DROP TABLE IF EXISTS `venue_opening_hours`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venue_opening_hours` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `venue_id` bigint NOT NULL,
  `weekday` tinyint NOT NULL,
  `open_minute` smallint NOT NULL,
  `close_minute` smallint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_opening_hours_segment` (`venue_id`,`weekday`,`open_minute`),
  CONSTRAINT `fk_opening_hours_venue_id` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  CONSTRAINT `chk_opening_minutes` CHECK ((((`open_minute` % 30) = 0) and ((`close_minute` % 30) = 0) and (`open_minute` >= 0) and (`open_minute` < `close_minute`) and (`close_minute` <= 1440))),
  CONSTRAINT `chk_opening_weekday` CHECK ((`weekday` between 0 and 6))
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venue_opening_hours`
--

LOCK TABLES `venue_opening_hours` WRITE;
/*!40000 ALTER TABLE `venue_opening_hours` DISABLE KEYS */;
INSERT INTO `venue_opening_hours` VALUES (1,1,1,480,1320),(2,1,2,480,1320),(3,1,3,480,1320),(4,1,4,480,1320),(5,1,5,480,1320),(6,2,1,480,1260),(7,2,2,480,1260),(8,2,3,480,1260),(9,2,4,480,1260),(10,2,5,480,1260),(11,3,0,540,1260),(12,3,1,540,1260),(13,3,2,540,1260),(14,3,3,540,1260),(15,3,4,540,1260),(16,3,5,540,1260),(17,3,6,540,1260),(18,4,0,480,1320),(19,4,1,480,1320),(20,4,2,480,1320),(21,4,3,480,1320),(22,4,4,480,1320),(23,4,5,480,1320),(24,4,6,480,1320),(25,5,0,420,1260),(26,5,1,420,1260),(27,5,2,420,1260),(28,5,3,420,1260),(29,5,4,420,1260),(30,5,5,420,1260),(31,5,6,420,1260);
/*!40000 ALTER TABLE `venue_opening_hours` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venue_reviewers`
--

DROP TABLE IF EXISTS `venue_reviewers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venue_reviewers` (
  `venue_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`venue_id`,`user_id`),
  KEY `ix_venue_reviewers_user` (`user_id`),
  CONSTRAINT `fk_venue_reviewers_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_venue_reviewers_venue_id` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venue_reviewers`
--

LOCK TABLES `venue_reviewers` WRITE;
/*!40000 ALTER TABLE `venue_reviewers` DISABLE KEYS */;
INSERT INTO `venue_reviewers` VALUES (2,3),(3,3);
/*!40000 ALTER TABLE `venue_reviewers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venues`
--

DROP TABLE IF EXISTS `venues`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venues` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `location` varchar(200) NOT NULL,
  `capacity` int NOT NULL,
  `equipment` json NOT NULL DEFAULT (json_array()),
  `requires_approval` tinyint NOT NULL DEFAULT '0',
  `is_active` tinyint NOT NULL DEFAULT '1',
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_venues_name` (`name`),
  CONSTRAINT `chk_venues_capacity` CHECK ((`capacity` >= 1))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venues`
--

LOCK TABLES `venues` WRITE;
/*!40000 ALTER TABLE `venues` DISABLE KEYS */;
INSERT INTO `venues` VALUES (1,'A101 小型會議室','A棟 1 樓',8,'[\"投影機\", \"白板\"]',0,1,'2026-11-07 07:08:02.989'),(2,'A201 大型會議室','A棟 2 樓',30,'[\"投影機\", \"麥克風\", \"視訊設備\"]',1,1,'2026-11-07 07:08:03.013'),(3,'B101 多功能教室','B棟 1 樓',50,'[\"投影機\", \"音響\", \"麥克風\"]',1,1,'2026-11-07 07:08:03.032'),(4,'C101 討論室','C棟 1 樓',6,'[\"白板\", \"電視螢幕\"]',0,1,'2026-11-07 07:08:03.048'),(5,'D1 體育館','D棟 地下 1 樓',100,'[\"音響\", \"籃球架\"]',0,1,'2026-11-07 07:08:03.064');
/*!40000 ALTER TABLE `venues` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `waitlist_entries`
--

DROP TABLE IF EXISTS `waitlist_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `waitlist_entries` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `venue_id` bigint NOT NULL,
  `start_at` datetime(3) NOT NULL,
  `end_at` datetime(3) NOT NULL,
  `subject` varchar(100) NOT NULL,
  `attendees` int NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `status` varchar(16) NOT NULL,
  `offer_expires_at` datetime(3) DEFAULT NULL,
  `close_reason` varchar(24) DEFAULT NULL,
  `closed_at` datetime(3) DEFAULT NULL,
  `booking_id` bigint DEFAULT NULL,
  `active_dup_key` tinyint GENERATED ALWAYS AS (if((`status` in (_utf8mb4'waiting',_utf8mb4'offered')),1,NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_waitlist_active_dup` (`user_id`,`venue_id`,`start_at`,`end_at`,`active_dup_key`),
  KEY `ix_waitlist_slot` (`venue_id`,`start_at`,`end_at`,`status`,`created_at`),
  KEY `ix_waitlist_user_status` (`user_id`,`status`,`created_at`),
  KEY `ix_waitlist_status_offer` (`status`,`offer_expires_at`),
  KEY `ix_waitlist_status_start` (`status`,`start_at`),
  KEY `fk_waitlist_booking_id` (`booking_id`),
  CONSTRAINT `fk_waitlist_booking_id` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`),
  CONSTRAINT `fk_waitlist_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_waitlist_venue_id` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`),
  CONSTRAINT `chk_waitlist_close_reason` CHECK (((`close_reason` is null) or (`close_reason` in (_utf8mb4'offer_timeout',_utf8mb4'confirm_failed',_utf8mb4'declined',_utf8mb4'venue_disabled',_utf8mb4'account_disabled',_utf8mb4'started',_utf8mb4'cancelled')))),
  CONSTRAINT `chk_waitlist_status` CHECK ((`status` in (_utf8mb4'waiting',_utf8mb4'offered',_utf8mb4'confirmed',_utf8mb4'expired',_utf8mb4'cancelled')))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `waitlist_entries`
--

LOCK TABLES `waitlist_entries` WRITE;
/*!40000 ALTER TABLE `waitlist_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `waitlist_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'venue_booking'
--

--
-- Dumping routines for database 'venue_booking'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-07  7:15:00
