package kz.eco.config;

import org.flywaydb.core.Flyway;

/**
 * One-off diagnostic runner: applies the Flyway migrations against an arbitrary MySQL
 * instance without booting the full Spring context. Usage:
 *   mvn -q test-compile exec:java -Dexec.classpathScope=test \
 *     -Dexec.mainClass=kz.eco.config.FlywayMigrationRunner \
 *     -Dexec.args="jdbc:mysql://localhost:33061/eco eco ecopass"
 */
public final class FlywayMigrationRunner {

    private FlywayMigrationRunner() {
    }

    public static void main(String[] args) {
        String url = args.length > 0 ? args[0] : "jdbc:mysql://localhost:33061/eco";
        String user = args.length > 1 ? args[1] : "eco";
        String password = args.length > 2 ? args[2] : "ecopass";

        Flyway flyway = Flyway.configure()
                .dataSource(url, user, password)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("2")
                .validateOnMigrate(false)
                .load();
        var result = flyway.migrate();
        System.out.println("Migrations executed: " + result.migrationsExecuted);
        System.out.println("Success: " + result.success);
        result.warnings.forEach(w -> System.out.println("WARN: " + w));
    }
}
