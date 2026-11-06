package com.clearpath.review.service.tasks;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class TaskQueryService {

    private static final String DAYS_FROM_OPENED =
            "GREATEST(0, (CURRENT_DATE - (cs.opened_at AT TIME ZONE 'UTC')::date))";

    private static final String MINE_INNER = """
            SELECT DISTINCT ON (m.id)
                m.id AS material_id,
                m.title,
                p.name AS product_name,
                mv.number AS version_number,
                cs.name AS step_name,
                %s AS days_waiting
            FROM material m
            INNER JOIN material_version mv ON mv.id = m.current_version_id
            INNER JOIN product p ON p.id = m.product_id
            INNER JOIN review_cycle rc ON rc.material_id = m.id
                AND rc.version_id = m.current_version_id
                AND rc.status = 'active'
            INNER JOIN cycle_step cs ON cs.cycle_id = rc.id AND cs.position = rc.current_position
            INNER JOIN cycle_requirement cr ON cr.cycle_step_id = cs.id
            INNER JOIN membership mem ON mem.group_id = cr.group_id AND mem.user_id = :userId
            WHERE m.obsolete_at IS NULL
              AND cs.opened_at IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM review r
                  WHERE r.cycle_id = rc.id
                    AND r.position = rc.current_position
                    AND r.group_id = cr.group_id
                    AND r.user_id = :userId
              )
              AND (
                  SELECT COUNT(*)::int
                  FROM review r
                  WHERE r.cycle_id = rc.id
                    AND r.position = rc.current_position
                    AND r.group_id = cr.group_id
                    AND r.counted = TRUE
              ) < cr.approvals_required
            ORDER BY m.id, cr.group_id
            """.formatted(DAYS_FROM_OPENED);

    private static final String MINE_LIST = """
            SELECT material_id, title, product_name, version_number, step_name, days_waiting
            FROM (%s) mine_rows
            ORDER BY days_waiting DESC, material_id
            """.formatted(MINE_INNER);

    private static final String MINE_COUNT = """
            SELECT COUNT(*)::int FROM (%s) mine_rows
            """.formatted(MINE_INNER);

    private static final String WORKFLOWS_LIST = """
            SELECT
                m.id AS material_id,
                m.title,
                p.name AS product_name,
                mv.number AS version_number,
                CASE
                    WHEN ms.status = 'in_review' THEN cs.name
                    ELSE 'Not submitted'
                END AS step_name,
                CASE
                    WHEN ms.status = 'in_review' THEN %s
                    ELSE GREATEST(0, (CURRENT_DATE - (mv.uploaded_at AT TIME ZONE 'UTC')::date))
                END AS days_waiting
            FROM material m
            INNER JOIN material_status_v ms ON ms.material_id = m.id
            INNER JOIN product p ON p.id = m.product_id
            INNER JOIN material_version mv ON mv.id = m.current_version_id
            LEFT JOIN review_cycle rc ON rc.material_id = m.id
                AND rc.version_id = m.current_version_id
                AND rc.status = 'active'
            LEFT JOIN cycle_step cs ON cs.cycle_id = rc.id AND cs.position = rc.current_position
            WHERE m.owner_id = :userId
              AND ms.status IN ('draft', 'in_review')
            ORDER BY days_waiting DESC, m.id
            """.formatted(DAYS_FROM_OPENED);

    private static final String WORKFLOWS_COUNT = """
            SELECT COUNT(*)::int
            FROM material m
            INNER JOIN material_status_v ms ON ms.material_id = m.id
            WHERE m.owner_id = :userId
              AND ms.status IN ('draft', 'in_review')
            """;

    private static final String UPCOMING_INNER = """
            SELECT DISTINCT ON (m.id)
                m.id AS material_id,
                m.title,
                p.name AS product_name,
                mv.number AS version_number,
                cs.name AS step_name,
                %s AS days_waiting
            FROM material m
            INNER JOIN material_version mv ON mv.id = m.current_version_id
            INNER JOIN product p ON p.id = m.product_id
            INNER JOIN review_cycle rc ON rc.material_id = m.id
                AND rc.version_id = m.current_version_id
                AND rc.status = 'active'
            INNER JOIN cycle_step cs ON cs.cycle_id = rc.id AND cs.position = rc.current_position
            INNER JOIN cycle_step future_cs ON future_cs.cycle_id = rc.id
                AND future_cs.position > rc.current_position
            INNER JOIN cycle_requirement future_cr ON future_cr.cycle_step_id = future_cs.id
            INNER JOIN membership mem ON mem.group_id = future_cr.group_id AND mem.user_id = :userId
            WHERE m.obsolete_at IS NULL
              AND cs.opened_at IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM cycle_requirement open_cr
                  INNER JOIN cycle_step open_cs ON open_cs.id = open_cr.cycle_step_id
                      AND open_cs.cycle_id = rc.id
                      AND open_cs.position = rc.current_position
                  INNER JOIN membership open_mem ON open_mem.group_id = open_cr.group_id
                      AND open_mem.user_id = :userId
                  WHERE NOT EXISTS (
                      SELECT 1
                      FROM review r
                      WHERE r.cycle_id = rc.id
                        AND r.position = rc.current_position
                        AND r.group_id = open_cr.group_id
                        AND r.user_id = :userId
                  )
                  AND (
                      SELECT COUNT(*)::int
                      FROM review r
                      WHERE r.cycle_id = rc.id
                        AND r.position = rc.current_position
                        AND r.group_id = open_cr.group_id
                        AND r.counted = TRUE
                  ) < open_cr.approvals_required
              )
            ORDER BY m.id, future_cs.position, future_cr.group_id
            """.formatted(DAYS_FROM_OPENED);

    private static final String UPCOMING_LIST = """
            SELECT material_id, title, product_name, version_number, step_name, days_waiting
            FROM (%s) upcoming_rows
            ORDER BY days_waiting DESC, material_id
            """.formatted(UPCOMING_INNER);

    private static final String UPCOMING_COUNT = """
            SELECT COUNT(*)::int FROM (%s) upcoming_rows
            """.formatted(UPCOMING_INNER);

    private final NamedParameterJdbcTemplate jdbc;

    public TaskQueryService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<TaskRow> listTasks(UUID userId, TaskTab tab) {
        String sql =
                switch (tab) {
                    case mine -> MINE_LIST;
                    case workflows -> WORKFLOWS_LIST;
                    case upcoming -> UPCOMING_LIST;
                };
        return jdbc.query(sql, params(userId), (rs, rowNum) -> toRow(rs, tab));
    }

    public TaskCounts counts(UUID userId) {
        MapSqlParameterSource params = params(userId);
        int mine = jdbc.queryForObject(MINE_COUNT, params, Integer.class);
        int workflows = jdbc.queryForObject(WORKFLOWS_COUNT, params, Integer.class);
        int upcoming = jdbc.queryForObject(UPCOMING_COUNT, params, Integer.class);
        return new TaskCounts(mine, workflows, upcoming);
    }

    private static MapSqlParameterSource params(UUID userId) {
        return new MapSqlParameterSource("userId", userId);
    }

    private static TaskRow toRow(java.sql.ResultSet rs, TaskTab tab) throws java.sql.SQLException {
        int daysWaiting = rs.getInt("days_waiting");
        return new TaskRow(
                rs.getObject("material_id", UUID.class),
                rs.getString("title"),
                rs.getString("product_name"),
                rs.getInt("version_number"),
                rs.getString("step_name"),
                daysWaiting,
                daysWaiting > 3,
                tab);
    }
}
