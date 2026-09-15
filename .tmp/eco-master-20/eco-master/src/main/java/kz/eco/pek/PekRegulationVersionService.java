package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Reference book (справочник) of PEK regulation editions - the single source of truth for which
 * normative edition a program or report was built against, and which document template that
 * edition prescribes.
 *
 * <p>This replaces the previous design, where a single {@code public static final String CURRENT}
 * was interpolated straight into the "Нормативная основа" header of generated documents. That was
 * unsafe in two ways: an edition change required a code edit in order to stop stamping a stale
 * citation, and a program approved under an older edition had no way to remember which edition
 * that was.
 *
 * <p><b>Stamping rule:</b> a program stamps {@code regulationCode} once, at creation, and keeps it
 * for life. Editions are never rewritten on existing rows - {@link #currentCode()} is read only
 * when creating a new program, or when a user explicitly re-templates an editable DRAFT.
 *
 * <p><b>Adding the next edition</b> (e.g. the 2026 amendment to п.23): append an entry to
 * {@link #ENTRIES} with its real order citation and {@code effectiveFrom}, set the previous
 * entry's {@code effectiveTo} to the day before, and point {@code pek.regulation.current-code} at
 * the new code. Deadline rules are keyed on the same code in
 * {@link PekSubmissionDeadlineService}, so the two move together.
 */
@Service
public class PekRegulationVersionService {

    /** Base edition: the order that originally approved the rules. */
    public static final String PEK_RULES_250_2021 = "PEK_RULES_250_2021";

    /** Edition in force since 19.04.2026, which is the one that reworded п.23 (deadlines). */
    public static final String PEK_RULES_250_2026_59 = "PEK_RULES_250_2026_59";

    /** First day the 2026 amendment applies. Rows created before this date were authored under the
     *  base edition; see V117's backfill. */
    public static final LocalDate AMENDMENT_2026_EFFECTIVE_FROM = LocalDate.of(2026, 4, 19);

    /**
     * Display string for the base edition, kept as the persisted default of
     * {@code regulation_version} on rows predating this reference book. It is the base edition's
     * citation, not "current" - new rows are stamped from {@link #current()}.
     *
     * @deprecated use {@link #current()} / {@link #currentCode()}.
     */
    @Deprecated
    public static final String CURRENT =
            "Правила №250 (Приказ МЭГПР РК от 14.07.2021 №250, рег. №23553)";

    private static final List<PekRegulationVersion> ENTRIES = List.of(
            new PekRegulationVersion(
                    PEK_RULES_250_2021,
                    "Правила №250",
                    "Приказ МЭГПР РК от 14.07.2021 №250 (зарегистрирован в Минюсте РК №23553)",
                    null,
                    LocalDate.of(2021, 7, 14),
                    AMENDMENT_2026_EFFECTIVE_FROM.minusDays(1),
                    "v1-legacy",
                    "v1-legacy"),
            new PekRegulationVersion(
                    PEK_RULES_250_2026_59,
                    "Правила №250",
                    "Приказ МЭГПР РК от 14.07.2021 №250 (зарегистрирован в Минюсте РК №23553)",
                    "Приказ Министра экологии и природных ресурсов РК от 30.03.2026 №59"
                            + " (зарегистрирован в Минюсте РК №38268 от 01.04.2026,"
                            + " опубликован 08.04.2026, введён в действие 19.04.2026)",
                    AMENDMENT_2026_EFFECTIVE_FROM,
                    null,
                    "v2-2026",
                    "v2-2026")
    );

    private static final Map<String, PekRegulationVersion> BY_CODE;

    static {
        Map<String, PekRegulationVersion> m = new LinkedHashMap<>();
        for (PekRegulationVersion e : ENTRIES) {
            m.put(e.code(), e);
        }
        BY_CODE = Map.copyOf(m);
    }

    /**
     * Which edition new programs/reports are stamped with. Configurable so that publishing a new
     * edition is an entry in {@link #ENTRIES} plus a property change, not a redeploy of every
     * caller that used to reference the old constant.
     */
    private final String currentCode;

    /** Item 1 of the PEK settings module fix: admin-editable catalog, backing this service once
     *  populated (see V125 migration). {@code null} for the plain no-arg-repository constructor
     *  below, used by {@code PekRegulationVersionRegistryTest} - a pure unit test that constructs
     *  this service directly with {@code new}, no Spring context, and must keep working exactly as
     *  before against the static {@link #ENTRIES} fallback. */
    private final PekRegulationVersionRepository repository;

    public PekRegulationVersionService(String currentCode) {
        this(currentCode, null);
    }

    @Autowired
    public PekRegulationVersionService(
            @Value("${pek.regulation.current-code:" + PEK_RULES_250_2026_59 + "}") String currentCode,
            @Autowired(required = false) PekRegulationVersionRepository repository) {
        if (repository == null && !BY_CODE.containsKey(currentCode)) {
            throw new IllegalStateException("pek.regulation.current-code=" + currentCode
                    + " отсутствует в справочнике версий нормативной базы: " + BY_CODE.keySet());
        }
        this.currentCode = currentCode;
        this.repository = repository;
    }

    public List<PekRegulationVersion> all() {
        if (repository != null) {
            List<PekRegulationVersionRow> rows = repository.findAllByOrderByEffectiveFromDesc();
            if (!rows.isEmpty()) {
                return rows.stream().map(PekRegulationVersionRow::toRecord).toList();
            }
        }
        return ENTRIES;
    }

    public String currentCode() {
        if (repository != null) {
            Optional<String> active = repository.findByStatus(PekRegulationVersionStatus.ACTIVE)
                    .map(PekRegulationVersionRow::getCode);
            if (active.isPresent()) {
                return active.get();
            }
        }
        return currentCode;
    }

    public PekRegulationVersion current() {
        return find(currentCode())
                .orElseThrow(() -> new IllegalStateException(
                        "Не настроена действующая версия нормативной базы ПЭК (нет строки со статусом ACTIVE"
                                + " в справочнике версий) - обратитесь к администратору для настройки \"Нормативная база\""));
    }

    public Optional<PekRegulationVersion> find(String code) {
        if (code == null) {
            return Optional.empty();
        }
        if (repository != null) {
            Optional<PekRegulationVersion> fromDb = repository.findByCode(code).map(PekRegulationVersionRow::toRecord);
            if (fromDb.isPresent()) {
                return fromDb;
            }
        }
        return Optional.ofNullable(BY_CODE.get(code));
    }

    public PekRegulationVersion require(String code) {
        return find(code).orElseThrow(() -> new BadRequestException(
                "Неизвестная версия нормативной базы: " + code));
    }

    /**
     * Resolves the edition a legacy row was stamped with. Rows created before the reference book
     * existed carry only the free-text {@code regulation_version} string; V115 backfills their
     * {@code regulation_code}, but this keeps read paths safe for anything the backfill missed.
     */
    public PekRegulationVersion resolve(String code, String legacyVersionString) {
        if (code != null) {
            Optional<PekRegulationVersion> byCode = find(code);
            if (byCode.isPresent()) return byCode.get();
        }
        if (legacyVersionString != null) {
            for (PekRegulationVersion e : ENTRIES) {
                if (legacyVersionString.contains(e.baseOrder())) return e;
            }
        }
        return BY_CODE.get(PEK_RULES_250_2021);
    }

    /** For injection points that prefer an instance method over a static reference. */
    @Deprecated
    public String currentVersionString() {
        return current().citation();
    }
}
