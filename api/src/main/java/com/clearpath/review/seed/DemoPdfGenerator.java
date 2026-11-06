package com.clearpath.review.seed;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("seed")
public class DemoPdfGenerator {

    private static final String DISCLAIMER =
            """
            This material is for internal review and demonstration purposes only. \
            It is not an offer, solicitation, or commitment to lend. Rates, terms, and \
            availability are subject to change without notice. Not all applicants will qualify.""";

    public byte[] generate(String title, int versionNumber) {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.LETTER);
            document.addPage(page);
            PDType1Font bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDType1Font regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            try (PDPageContentStream stream = new PDPageContentStream(document, page)) {
                float y = 720;
                stream.beginText();
                stream.setFont(bold, 18);
                stream.newLineAtOffset(72, y);
                stream.showText(safeText(title));
                stream.endText();

                y -= 28;
                stream.beginText();
                stream.setFont(regular, 12);
                stream.newLineAtOffset(72, y);
                stream.showText("Version " + versionNumber);
                stream.endText();

                y -= 36;
                for (String line : wrap(DISCLAIMER, 85)) {
                    stream.beginText();
                    stream.setFont(regular, 11);
                    stream.newLineAtOffset(72, y);
                    stream.showText(line);
                    stream.endText();
                    y -= 16;
                }

                y -= 24;
                stream.beginText();
                stream.setFont(regular, 11);
                stream.newLineAtOffset(72, y);
                stream.showText("Body copy placeholder for marketing review workflows.");
                stream.endText();
            }

            if (title.length() + versionNumber > 40) {
                PDPage page2 = new PDPage(PDRectangle.LETTER);
                document.addPage(page2);
                try (PDPageContentStream stream = new PDPageContentStream(document, page2)) {
                    stream.beginText();
                    stream.setFont(regular, 11);
                    stream.newLineAtOffset(72, 720);
                    stream.showText("Additional terms and conditions appear on this page for longer materials.");
                    stream.endText();
                }
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to generate demo PDF", e);
        }
    }

    private static String safeText(String text) {
        return text.replace('\u2014', '-');
    }

    private static String[] wrap(String text, int width) {
        String[] words = text.split("\\s+");
        StringBuilder line = new StringBuilder();
        java.util.List<String> lines = new java.util.ArrayList<>();
        for (String word : words) {
            if (line.isEmpty()) {
                line.append(word);
            } else if (line.length() + 1 + word.length() <= width) {
                line.append(' ').append(word);
            } else {
                lines.add(line.toString());
                line = new StringBuilder(word);
            }
        }
        if (!line.isEmpty()) {
            lines.add(line.toString());
        }
        return lines.toArray(String[]::new);
    }
}
