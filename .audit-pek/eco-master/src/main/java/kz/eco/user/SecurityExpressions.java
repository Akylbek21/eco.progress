package kz.eco.user;

public final class SecurityExpressions {

    public static final String STAFF = "hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','ACCOUNTANT','ECOLOGIST','LABORATORY','WASTE_SPECIALIST')";

    /** /api/staff/documents permission matrix - every authenticated staff role may view/download
     *  its shared document archive; upload is likewise open to all staff (any employee may add a
     *  document). Deletion is additionally gated per-document by ownership/ADMIN-DIRECTOR inside
     *  CrmDocumentService#canDelete - this role gate is the first (coarser) layer, not the only one. */
    public static final String DOCUMENT_VIEW = STAFF;
    public static final String DOCUMENT_UPLOAD = STAFF;
    public static final String DOCUMENT_DOWNLOAD = STAFF;
    public static final String DOCUMENT_DELETE = STAFF;

    public static final String ADMIN_ONLY = "hasRole('ADMIN')";

    /** Модуль протоколов испытаний (лаборатория) - просмотр, создание, черновик/результаты. */
    public static final String LAB_PROTOCOL = "hasAnyRole('ADMIN','DIRECTOR','HEAD','LABORATORY')";
    /** Module spec §3: MANAGER/ACCOUNTANT/ECOLOGIST/WASTE_SPECIALIST must not get full protocol
     *  CRUD access just by role, but they may need read-only visibility into protocols linked to
     *  their own work (e.g. an order, a ПЭК program) - this is that narrower, read-only grant,
     *  layered on top of LAB_PROTOCOL rather than replacing it. */
    public static final String PROTOCOL_VIEW =
            "hasAnyRole('ADMIN','DIRECTOR','HEAD','LABORATORY','MANAGER','ACCOUNTANT','ECOLOGIST','WASTE_SPECIALIST')";
    /** Возврат на доработку, утверждение, подписание, исправленная версия, отмена, архивирование -
     *  LABORATORY не имеет права на эти операции, только оформляет и отправляет на утверждение. */
    public static final String PROTOCOL_SUPERVISOR = "hasAnyRole('ADMIN','DIRECTOR','HEAD')";
    /** Read companies/objects list+card - matches COMPANY_EDIT plus LABORATORY (read-only there). */
    public static final String COMPANY_ACCESS = "hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER','LABORATORY')";
    /** Create/update companies and objects - LABORATORY is read-only here. */
    public static final String COMPANY_EDIT = "hasAnyRole('ADMIN','DIRECTOR','HEAD','MANAGER')";
    /** Create a new company (and manage its team membership) - same trust tier as COMPANY_EDIT,
     *  named separately so the API/permission-matrix contract has a distinct COMPANY_CREATE key. */
    public static final String COMPANY_CREATE = COMPANY_EDIT;
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
    /** SEO-review workflow for news/articles (submit/approve/publish/return/revoke) - editorial
     *  gate, same tier as LAB_LOGO_MANAGE. */
    public static final String NEWS_REVIEW = "hasAnyRole('ADMIN','DIRECTOR')";
    /** SEO-review workflow for programmatic service-city landing pages - same editorial tier as
     *  NEWS_REVIEW. */
    public static final String CITY_CONTENT_REVIEW = "hasAnyRole('ADMIN','DIRECTOR')";
    /** Review workflow for the eco_services catalogue (kz.eco.services) - same editorial tier. */
    public static final String SERVICE_CONTENT_REVIEW = "hasAnyRole('ADMIN','DIRECTOR')";
    /** Verification workflow for Expert/TrustDocument records (kz.eco.content) - same editorial
     *  tier; a real person confirms credentials/licenses before they're exposed publicly. */
    public static final String CONTENT_VERIFICATION = "hasAnyRole('ADMIN','DIRECTOR')";
    /** CaseStudy CMS workflow (kz.eco.content.CaseStudy) - same editorial tier; "публикация только
     *  после экспертной проверки" - a real person must review before a case can go live. */
    public static final String CASE_STUDY_REVIEW = "hasAnyRole('ADMIN','DIRECTOR')";
    /** Создание новой лаборатории - DIRECTOR added per RBAC audit (frontend shows this action to
     *  DIRECTOR, backend previously allowed only ADMIN). */
    public static final String LAB_CREATE = "hasAnyRole('ADMIN','DIRECTOR')";
    /** Раздел "Журналы" лаборатории. DIRECTOR added: frontend already reads journals as DIRECTOR. */
    public static final String LAB_JOURNALS = "hasAnyRole('ADMIN','DIRECTOR','HEAD','LABORATORY')";

    /** Просмотр/поиск справочника нормативов - все роли, работающие с протоколами (same as
     *  LAB_PROTOCOL; kept as a distinct name so read access to normatives isn't accidentally
     *  coupled to protocol CRUD if the two ever diverge). */
    public static final String NORMATIVE_VIEW = LAB_PROTOCOL;
    /** Изменение справочника нормативов (создание/редактирование/архивирование/массовые операции) -
     *  module spec §4: LABORATORY must NOT be able to edit the shared normative dictionary, only
     *  ADMIN and, like LAB_LOGO_MANAGE, an explicitly trusted DIRECTOR. */
    public static final String NORMATIVE_MANAGE = "hasAnyRole('ADMIN','DIRECTOR')";
    /** Импорт нормативов из Excel (preview/confirm) - same trust tier as NORMATIVE_MANAGE. */
    public static final String NORMATIVE_IMPORT = NORMATIVE_MANAGE;

    private SecurityExpressions() {
    }
}
