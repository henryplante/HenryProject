package com.clearpath.review.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.clearpath.review.support.AbstractPostgresIT;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles({"test", "seed"})
class SeedDataIT extends AbstractPostgresIT {

    @Autowired
    private SeedDataLoader seedDataLoader;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void runningSeedTwiceKeepsCountsStable() {
        seedDataLoader.ensureSeeded();
        Map<String, Long> afterFirst = tableCounts();
        seedDataLoader.ensureSeeded();
        Map<String, Long> afterSecond = tableCounts();
        assertThat(afterSecond).isEqualTo(afterFirst);
    }

    @Test
    void materialStatusesCoverAllLibraryStates() {
        seedDataLoader.ensureSeeded();
        List<String> statuses =
                jdbc.queryForList("SELECT DISTINCT status FROM material_status_v ORDER BY status", String.class);
        assertThat(statuses)
                .containsExactlyInAnyOrder("approved", "draft", "expired", "in_review", "obsolete");
    }

    @Test
    void walkthroughMaterialMatchesSpec() {
        seedDataLoader.ensureSeeded();
        UUID materialId = jdbc.queryForObject(
                "SELECT material_id FROM material_status_v ms JOIN material m ON m.id = ms.material_id WHERE m.title = ?",
                UUID.class,
                SeedConstants.WALKTHROUGH_TITLE);
        assertThat(jdbc.queryForObject(
                        "SELECT status FROM material_status_v WHERE material_id = ?", String.class, materialId))
                .isEqualTo("in_review");

        UUID v1 = jdbc.queryForObject(
                "SELECT id FROM material_version WHERE material_id = ? AND number = 1", UUID.class, materialId);
        UUID v2 = jdbc.queryForObject(
                "SELECT id FROM material_version WHERE material_id = ? AND number = 2", UUID.class, materialId);

        assertThat(jdbc.queryForObject(
                        "SELECT status FROM version_status_v WHERE version_id = ?", String.class, v1))
                .isEqualTo("approved");
        assertThat(jdbc.queryForObject(
                        "SELECT status FROM version_status_v WHERE version_id = ?", String.class, v2))
                .isEqualTo("in_review");

        assertThat(jdbc.queryForObject(
                        "SELECT approved_version_id FROM material WHERE id = ?", UUID.class, materialId))
                .isEqualTo(v1);
        assertThat(jdbc.queryForObject(
                        "SELECT current_version_id FROM material WHERE id = ?", UUID.class, materialId))
                .isEqualTo(v2);

        Integer legalRequired = jdbc.queryForObject(
                """
                SELECT cr.approvals_required
                FROM review_cycle rc
                JOIN cycle_step cs ON cs.cycle_id = rc.id AND cs.position = rc.current_position
                JOIN cycle_requirement cr ON cr.cycle_step_id = cs.id
                JOIN user_group g ON g.id = cr.group_id
                WHERE rc.material_id = ? AND rc.status = 'active' AND g.name = ?
                """,
                Integer.class,
                materialId,
                SeedConstants.GROUP_LEGAL);
        assertThat(legalRequired).isEqualTo(2);

        Integer countedApprovals = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM review r
                JOIN review_cycle rc ON rc.id = r.cycle_id
                WHERE rc.material_id = ? AND rc.status = 'active' AND r.position = rc.current_position AND r.counted
                """,
                Integer.class,
                materialId);
        assertThat(countedApprovals).isZero();

        Integer comments =
                jdbc.queryForObject("SELECT COUNT(*) FROM comment WHERE version_id = ?", Integer.class, v2);
        assertThat(comments).isGreaterThanOrEqualTo(1);
    }

    @Test
    void overdueStepOneShowsOneOfTwoCountedApprovals() {
        seedDataLoader.ensureSeeded();
        UUID materialId = jdbc.queryForObject(
                "SELECT id FROM material WHERE title = ?", UUID.class, "Promotional APR email");

        Integer counted = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM review r
                JOIN review_cycle rc ON rc.id = r.cycle_id
                JOIN user_group g ON g.id = r.group_id
                WHERE rc.material_id = ? AND rc.status = 'active' AND r.position = 1
                  AND g.name = ? AND r.counted
                """,
                Integer.class,
                materialId,
                SeedConstants.GROUP_LEGAL);
        assertThat(counted).isEqualTo(1);
    }

    @Test
    void generatedPdfsAreValid() throws Exception {
        seedDataLoader.ensureSeeded();
        List<byte[]> pdfs = jdbc.query("SELECT bytes FROM file_blob", (rs, row) -> rs.getBytes(1));
        assertThat(pdfs).isNotEmpty();
        for (byte[] pdf : pdfs) {
            assertThat(new String(pdf, 0, Math.min(4, pdf.length))).isEqualTo("%PDF");
            try (PDDocument doc = Loader.loadPDF(pdf)) {
                assertThat(doc.getNumberOfPages()).isGreaterThanOrEqualTo(1);
            }
        }
    }

    private Map<String, Long> tableCounts() {
        return Map.of(
                "app_user", count("app_user"),
                "material", count("material"),
                "material_version", count("material_version"),
                "file_blob", count("file_blob"),
                "review_cycle", count("review_cycle"),
                "notification", count("notification"));
    }

    private long count(String table) {
        Long value = jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
        return value == null ? 0L : value;
    }
}
