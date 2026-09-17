package kz.eco.protocol.docgen;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

/**
 * One-off generator for the real classpath DOCX templates under
 * src/main/resources/templates/protocols/. Run after changing
 * ProtocolTemplateSeedBuilder's layout:
 *   mvn -q test-compile exec:java -Dexec.classpathScope=test \
 *     -Dexec.mainClass=kz.eco.protocol.docgen.GenerateProtocolTemplates [-Dexec.args="AMBIENT_AIR_SZZ ..."]
 * With arguments only the named ProtocolTemplateKeys are (re)written, leaving the other templates
 * byte-for-byte untouched.
 */
public final class GenerateProtocolTemplates {

    private GenerateProtocolTemplates() {
    }

    public static void main(String[] args) throws IOException {
        Path dir = Path.of("src/main/resources/templates/protocols");
        Files.createDirectories(dir);
        List<ProtocolTemplateKey> keys = args.length == 0 ? ProtocolTemplateKey.all()
                : Arrays.stream(args).map(ProtocolTemplateKey::valueOf).toList();
        for (ProtocolTemplateKey key : keys) {
            byte[] bytes = ProtocolTemplateSeedBuilder.build(key);
            Path file = dir.resolve(key.fileName());
            Files.write(file, bytes);
            System.out.println("Wrote " + file);
        }
    }
}
