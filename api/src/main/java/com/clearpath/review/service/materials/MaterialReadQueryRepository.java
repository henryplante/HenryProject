package com.clearpath.review.service.materials;

import com.clearpath.review.domain.MaterialChannel;
import com.clearpath.review.web.materials.dto.MaterialSummaryDto;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MaterialReadQueryRepository {

    private final JdbcTemplate jdbcTemplate;

    public MaterialReadQueryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<MaterialSummaryDto> listMaterials(
            UUID viewerId,
            String q,
            UUID productId,
            MaterialStatus status,
            MaterialChannel channel,
            Boolean owned,
            Boolean favorites) {
        StringBuilder sql = new StringBuilder(
                """
                SELECT m.id, m.title, m.product_id, p.name AS product_name, m.channel, ms.status,
                       m.owner_id, COALESCE(mv.number, 0) AS current_version_number, m.approved_until,
                       (f.user_id IS NOT NULL) AS favorited
                FROM material m
                JOIN material_status_v ms ON ms.material_id = m.id
                JOIN product p ON p.id = m.product_id
                LEFT JOIN material_version mv ON mv.id = m.current_version_id
                LEFT JOIN favorite f ON f.material_id = m.id AND f.user_id = ?
                WHERE 1 = 1
                """);
        List<Object> params = new ArrayList<>();
        params.add(viewerId);

        if (q != null && !q.isBlank()) {
            sql.append(" AND m.title ILIKE ?");
            params.add("%" + q.trim() + "%");
        }
        if (productId != null) {
            sql.append(" AND m.product_id = ?");
            params.add(productId);
        }
        if (status != null) {
            sql.append(" AND ms.status = ?");
            params.add(status.name());
        }
        if (channel != null) {
            sql.append(" AND m.channel = ?");
            params.add(channel.name());
        }
        if (Boolean.TRUE.equals(owned)) {
            sql.append(" AND m.owner_id = ?");
            params.add(viewerId);
        }
        if (Boolean.TRUE.equals(favorites)) {
            sql.append(" AND f.user_id IS NOT NULL");
        }

        sql.append(" ORDER BY m.updated_at DESC");

        return jdbcTemplate.query(sql.toString(), params.toArray(), (rs, rowNum) -> mapSummaryRow(rs, viewerId));
    }

    public MaterialStatus loadMaterialStatus(UUID materialId) {
        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM material_status_v WHERE material_id = ?", String.class, materialId);
        return MaterialStatus.valueOf(status);
    }

    public Map<UUID, VersionStatus> loadVersionStatuses(UUID materialId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT version_id, status FROM version_status_v WHERE material_id = ?", materialId);
        Map<UUID, VersionStatus> result = new HashMap<>();
        for (Map<String, Object> row : rows) {
            UUID versionId = (UUID) row.get("version_id");
            String status = (String) row.get("status");
            result.put(versionId, VersionStatus.valueOf(status));
        }
        return result;
    }

    public VersionStatus loadVersionStatus(UUID versionId) {
        String status = jdbcTemplate.queryForObject(
                "SELECT status FROM version_status_v WHERE version_id = ?", String.class, versionId);
        return VersionStatus.valueOf(status);
    }

    private MaterialSummaryDto mapSummaryRow(ResultSet rs, UUID viewerId) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        String title = rs.getString("title");
        UUID productId = rs.getObject("product_id", UUID.class);
        String productName = rs.getString("product_name");
        MaterialChannel materialChannel = MaterialChannel.valueOf(rs.getString("channel"));
        MaterialStatus materialStatus = MaterialStatus.valueOf(rs.getString("status"));
        UUID ownerId = rs.getObject("owner_id", UUID.class);
        int currentVersionNumber = rs.getInt("current_version_number");
        boolean favorited = rs.getBoolean("favorited");
        Instant approvedUntil = readInstant(rs, "approved_until");
        if (materialStatus != MaterialStatus.approved && materialStatus != MaterialStatus.expired) {
            approvedUntil = null;
        }
        return new MaterialSummaryDto(
                id,
                title,
                productId,
                productName,
                materialChannel,
                materialStatus,
                ownerId,
                currentVersionNumber,
                favorited,
                approvedUntil);
    }

    private static Instant readInstant(ResultSet rs, String column) throws SQLException {
        Timestamp timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }
}
