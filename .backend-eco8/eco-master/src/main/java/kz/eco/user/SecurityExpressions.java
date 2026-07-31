package kz.eco.user;

public final class SecurityExpressions {

    public static final String STAFF = "hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')";

    public static final String ADMIN_ONLY = "hasRole('ADMIN')";

    /** Модуль протоколов испытаний (лаборатория) - просмотр, создание, черновик/результаты. */
    public static final String LAB_PROTOCOL = "hasAnyRole('ADMIN','DIRECTOR','HEAD','LABORATORY')";
    /** Возврат на доработку, утверждение, подписание, исправленная версия, отмена, архивирование -
     *  LABORATORY не имеет права на эти операции, только оформляет и отправляет на утверждение. */
    public static final String PROTOCOL_SUPERVISOR = "hasAnyRole('ADMIN','DIRECTOR','HEAD')";
    /** Read companies/objects list+card - matches COMPANY_EDIT plus LABORATORY (read-only there). */
    public static final String COMPANY_ACCESS = "hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','LABORATORY')";
    /** Create/update companies and objects - LABORATORY is read-only here. */
    public static final String COMPANY_EDIT = "hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER')";
    /** Archive/restore companies and objects - narrower than COMPANY_EDIT (no MANAGER). */
    public static final String COMPANY_ARCHIVE = "hasAnyRole('ADMIN','DIRECTOR','HEAD')";
    /** Управление логотипом лаборатории - ADMIN/DIRECTOR only per RBAC audit finding P0.3
     *  (frontend's manage screen only ever shows this action to those two roles). */
    public static final String LAB_LOGO_MANAGE = "hasAnyRole('ADMIN','DIRECTOR')";
    /** Настройки лаборатории - чтение карточки/списка/сотрудников. DIRECTOR added: frontend
     *  already shows this to DIRECTOR, backend was 403'ing it (audit finding). */
    public static final String LAB_SETTINGS_READ = "hasAnyRole('ADMIN','DIRECTOR','HEAD','LABORATORY')";
    /** Настройки лаборатории - редактирование карточки/заведующего/сотрудников (без логотипа/БИН/аттестата - те ADMIN-only). */
    public static final String LAB_SETTINGS_WRITE = "hasAnyRole('ADMIN','DIRECTOR','HEAD')";
    /** Создание новой лаборатории - DIRECTOR added per RBAC audit (frontend shows this action to
     *  DIRECTOR, backend previously allowed only ADMIN). */
    public static final String LAB_CREATE = "hasAnyRole('ADMIN','DIRECTOR')";
    /** Раздел "Журналы" лаборатории. DIRECTOR added: frontend already reads journals as DIRECTOR. */
    public static final String LAB_JOURNALS = "hasAnyRole('ADMIN','DIRECTOR','HEAD','LABORATORY')";

    private SecurityExpressions() {
    }
}
