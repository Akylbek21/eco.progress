package kz.eco.protocol.docgen;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * One-off generator for the real classpath DOCX templates under
 * src/main/resources/templates/protocols/. Run after changing
 * ProtocolTemplateSeedBuilder's layout:
 *   mvn -q test-compile exec:java -Dexec.classpathScope=test \
 *     -Dexec.mainClass=kz.eco.protocol.docgen.GenerateProtocolTemplates
 */
public final class GenerateProtocolTemplates {

    private GenerateProtocolTemplates() {
    }

    public static void main(String[] args) throws IOException {
        Path dir = Path.of("src/main/resources/templates/protocols");
        Files.createDirectories(dir);
        for (ProtocolTemplateKey key : ProtocolTemplateKey.all()) {
            byte[] bytes = ProtocolTemplateSeedBuilder.build(key);
            Path file = dir.resolve(key.fileName());
            Files.write(file, bytes);
            System.out.println("Wrote " + file);
        }
    }
}
