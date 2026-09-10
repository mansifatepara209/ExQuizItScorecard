-- Create database with proper charset
CREATE DATABASE IF NOT EXISTS ex_quiz_it 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;
USE ex_quiz_it;

SET NAMES utf8mb4;

-- ============================================
-- 1. EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_started BOOLEAN DEFAULT FALSE,
    current_round_id INT,
    current_question_index INT DEFAULT 0,
    regular_round_sequence_index INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS teams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    team_order INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50) NOT NULL,
    institution VARCHAR(200),
    members TEXT,
    member_count INT DEFAULT 0,
    captain_name VARCHAR(100),
    captain_email VARCHAR(100),
    captain_phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_order (event_id, team_order),
    INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. TEAM MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS team_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    team_id INT NOT NULL,
    member_name VARCHAR(100) NOT NULL,
    member_email VARCHAR(100),
    member_phone VARCHAR(20),
    member_role VARCHAR(50),
    member_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    INDEX idx_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. ROUNDS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS rounds (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    round_order INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    question_count INT DEFAULT 0,
    type ENUM('regular', 'buzzer') NOT NULL,
    difficulty ENUM('easy', 'moderate', 'hard') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_order (event_id, round_order),
    INDEX idx_event (event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. SCORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    team_id INT NOT NULL,
    round_id INT NOT NULL,
    question_index INT NOT NULL,
    action VARCHAR(20) NOT NULL,
    points INT NOT NULL,
    before_score INT NOT NULL,
    after_score INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    undo_info JSON,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE,
    INDEX idx_team_round (team_id, round_id),
    INDEX idx_event_time (event_id, timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    details JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    INDEX idx_event_action (event_id, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. SCORING CONFIG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scoring_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    event_id INT NOT NULL,
    action VARCHAR(20) NOT NULL,
    points INT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE KEY unique_event_action (event_id, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Default event
INSERT INTO events (id, name, description, is_active) VALUES 
(1, 'Ex-Quiz-It Championship 2026', 'Annual quiz competition', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Default scoring config
INSERT INTO scoring_config (event_id, action, points) VALUES
(1, 'correct', 10),
(1, 'half_correct', 5),
(1, 'wrong', 0),
(1, 'pass', 0),
(1, 'penalty', -10)
ON DUPLICATE KEY UPDATE points = VALUES(points);