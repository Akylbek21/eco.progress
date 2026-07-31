package kz.eco.config;

import kz.eco.client.Client;
import kz.eco.client.ClientRepository;
import kz.eco.company.BusinessCompany;
import kz.eco.company.BusinessCompanyRepository;
import kz.eco.contract.Contract;
import kz.eco.contract.ContractQuarter;
import kz.eco.contract.ContractRepository;
import kz.eco.employee.Employee;
import kz.eco.employee.EmployeeRepository;
import kz.eco.news.News;
import kz.eco.news.NewsRepository;
import kz.eco.notification.Notification;
import kz.eco.notification.NotificationRepository;
import kz.eco.order.*;
import kz.eco.payment.*;
import kz.eco.services.EcoService;
import kz.eco.services.EcoServiceRepository;
import kz.eco.services.ServiceCategory;
import kz.eco.tariff.Tariff;
import kz.eco.tariff.TariffMode;
import kz.eco.tariff.TariffRepository;
import kz.eco.user.ClientType;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Configuration
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final BusinessCompanyRepository businessCompanyRepository;
    private final EcoServiceRepository ecoServiceRepository;
    private final EmployeeRepository employeeRepository;
    private final NewsRepository newsRepository;
    private final TariffRepository tariffRepository;
    private final OrderRepository orderRepository;
    private final ContractRepository contractRepository;
    private final NotificationRepository notificationRepository;
    private final PaymentRepository paymentRepository;
    private final DebtRepository debtRepository;
    private final PasswordEncoder passwordEncoder;

    private User managerUser;
    private User accountantUser;
    private User ecologistUser;
    private User labUser;
    private User clientUser;
    private Client clientEntity;

    public DataSeeder(UserRepository userRepository,
                      ClientRepository clientRepository,
                      BusinessCompanyRepository businessCompanyRepository,
                      EcoServiceRepository ecoServiceRepository,
                      EmployeeRepository employeeRepository,
                      NewsRepository newsRepository,
                      TariffRepository tariffRepository,
                      OrderRepository orderRepository,
                      ContractRepository contractRepository,
                      NotificationRepository notificationRepository,
                      PaymentRepository paymentRepository,
                      DebtRepository debtRepository,
                      PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.businessCompanyRepository = businessCompanyRepository;
        this.ecoServiceRepository = ecoServiceRepository;
        this.employeeRepository = employeeRepository;
        this.newsRepository = newsRepository;
        this.tariffRepository = tariffRepository;
        this.orderRepository = orderRepository;
        this.contractRepository = contractRepository;
        this.notificationRepository = notificationRepository;
        this.paymentRepository = paymentRepository;
        this.debtRepository = debtRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        seedBusinessCompanies();
        seedUsers();
        seedClients();
        seedServices();
        seedEmployees();
        seedNews();
        seedTariffs();
        seedOrders();
        seedContracts();
        seedPayments();
        seedDebts();
        seedNotifications();
    }

    // ── Business Companies ──────────────────────────────────────────────

    private void seedBusinessCompanies() {
        if (businessCompanyRepository.count() > 0) return;

        businessCompanyRepository.save(company("eco-docs", "ECOPROGRESS Documents",
                "Экологическое проектирование, разрешительная документация и сопровождение предприятий",
                "+7 (7172) 00-00-01", "docs@ecoprogress.kz"));
        businessCompanyRepository.save(company("eco-lab", "ECOPROGRESS Laboratory",
                "Лабораторные исследования и замеры",
                "+7 (7172) 00-00-02", "lab@ecoprogress.kz"));
        businessCompanyRepository.save(company("eco-waste", "ECOPROGRESS Waste",
                "Обращение с отходами и транспортировка",
                "+7 (7172) 00-00-03", "waste@ecoprogress.kz"));
        businessCompanyRepository.save(company("eco-poligon", "ECOPROGRESS Poligon",
                "Полигон и размещение отходов",
                "+7 (7172) 00-00-04", "poligon@ecoprogress.kz"));
    }

    private BusinessCompany company(String id, String name, String description, String phone, String email) {
        BusinessCompany c = new BusinessCompany();
        c.setId(id);
        c.setName(name);
        c.setDescription(description);
        c.setPhone(phone);
        c.setEmail(email);
        c.setActive(true);
        return c;
    }

    // ── Users ───────────────────────────────────────────────────────────

    private void seedUsers() {
        if (userRepository.count() > 0) {
            managerUser = userRepository.findByEmailIgnoreCase("manager@ecoprogress.kz").orElse(null);
            accountantUser = userRepository.findByEmailIgnoreCase("accountant@ecoprogress.kz").orElse(null);
            ecologistUser = userRepository.findByEmailIgnoreCase("ecologist@ecoprogress.kz").orElse(null);
            labUser = userRepository.findByEmailIgnoreCase("lab@ecoprogress.kz").orElse(null);
            clientUser = userRepository.findByEmailIgnoreCase("client@ecoprogress.kz").orElse(null);
            return;
        }

        userRepository.save(user("admin@ecoprogress.kz", "admin123",
                "Администратор ECOPROGRESS GROUP", UserRole.ADMIN, ClientType.admin, "Администратор"));

        managerUser = userRepository.save(user("manager@ecoprogress.kz", "demo123",
                "Менеджер ECOPROGRESS GROUP", UserRole.MANAGER, ClientType.staff,
                "Менеджер по работе с клиентами"));

        accountantUser = userRepository.save(user("accountant@ecoprogress.kz", "demo123",
                "Бухгалтер ECOPROGRESS GROUP", UserRole.ACCOUNTANT, ClientType.staff, "Бухгалтер"));

        ecologistUser = userRepository.save(user("ecologist@ecoprogress.kz", "demo123",
                "Эколог ECOPROGRESS GROUP", UserRole.ECOLOGIST, ClientType.staff, "Эколог-проектировщик"));

        labUser = userRepository.save(user("lab@ecoprogress.kz", "demo123",
                "Лаборант ECOPROGRESS GROUP", UserRole.LABORATORY, ClientType.staff,
                "Специалист лаборатории"));

        clientUser = userRepository.save(clientUserBuilder());
    }

    private User user(String email, String password, String name, UserRole role,
                      ClientType type, String position) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode(password));
        u.setName(name);
        u.setRole(role);
        u.setType(type);
        u.setPosition(position);
        return u;
    }

    private User clientUserBuilder() {
        User u = new User();
        u.setEmail("client@ecoprogress.kz");
        u.setPasswordHash(passwordEncoder.encode("demo123"));
        u.setName("Контактное лицо");
        u.setRole(UserRole.CLIENT);
        u.setType(ClientType.company);
        u.setPhone("+7 (___) ___-__-__");
        u.setCity("Астана");
        u.setCompanyName("ТОО \"Клиент Eco\"");
        u.setBin("000000000000");
        u.setOrganizationType("ТОО");
        u.setLegalAddress("Республика Казахстан, г. Астана");
        u.setPosition("Менеджер");
        return u;
    }

    // ── Clients ─────────────────────────────────────────────────────────

    private void seedClients() {
        if (clientRepository.count() > 0) {
            if (clientUser != null) {
                clientEntity = clientRepository.findByUserId(clientUser.getId()).orElse(null);
            }
            return;
        }
        if (clientUser == null) return;

        Client c = new Client();
        c.setUser(clientUser);
        c.setClientType(ClientType.company);
        c.setCompanyName("ТОО \"Клиент Eco\"");
        c.setBinIin("000000000000");
        c.setLegalAddress("Республика Казахстан, г. Астана");
        c.setActualAddress("Республика Казахстан, г. Астана, ул. Примерная 1");
        c.setContactPerson("Контактное лицо");
        c.setPhone("+7 (___) ___-__-__");
        c.setEmail("client@ecoprogress.kz");
        clientEntity = clientRepository.save(c);
    }

    // ── Services ────────────────────────────────────────────────────────

    private void seedServices() {
        if (ecoServiceRepository.count() > 0) return;

        ecoServiceRepository.save(buildService("eco-design", "eco-docs",
                "Экологическое проектирование", ServiceCategory.PROJECTING,
                "Разрабатываем экологическую документацию для предприятий, строительных объектов, производственных площадок и организаций.",
                "Предприятиям, строительным объектам, производственным площадкам и организациям, которым нужны экологические проекты и согласования.",
                "Готовая проектная документация, подготовленная в соответствии с требованиями Экологического кодекса Республики Казахстан.",
                List.of(
                        "Разработка раздела охраны окружающей среды — РООС",
                        "Разработка проекта оценки воздействия на окружающую среду — ОВОС",
                        "Подготовка отчета о возможных воздействиях — ОВВ",
                        "Подготовка заявления о намечаемой деятельности — ЗОНД",
                        "Разработка проектов нормативов допустимых выбросов — НДВ",
                        "Разработка нормативов предельно допустимых сбросов — ПДС",
                        "Разработка проекта санитарно-защитной зоны — СЗЗ",
                        "Разработка проекта утилизации отходов",
                        "Разработка программы управления отходами — ПУО",
                        "Разработка программы производственного экологического контроля — ПЭК",
                        "Разработка плана природоохранных мероприятий — ППМ",
                        "Инвентаризация источников выбросов парниковых газов"),
                List.of("Реквизиты компании", "Описание деятельности объекта", "Проектные данные",
                        "Схемы площадки", "Сведения об источниках выбросов, сбросов и отходов"),
                List.of("Изучаем объект и исходные данные", "Определяем перечень необходимых проектов",
                        "Разрабатываем документацию", "Согласовываем материалы с клиентом",
                        "Сопровождаем дальнейшие процедуры"),
                "срок зависит от состава проекта"));

        ecoServiceRepository.save(buildService("permits", "eco-docs",
                "Разрешительная документация", ServiceCategory.PERMITS,
                "Помогаем компаниям подготовить и получить необходимую разрешительную экологическую документацию для законной деятельности предприятия.",
                "Компаниям и объектам I, II, III и IV категорий, которым нужно пройти экологические процедуры и получить согласования.",
                "Подготовленный пакет документов и сопровождение до получения нужного разрешения или согласования.",
                List.of("Получение комплексного экологического разрешения — КЭР",
                        "Подготовка документов для экологических согласований",
                        "Сопровождение при прохождении экологических процедур",
                        "Подготовка документов для объектов I, II, III и IV категорий",
                        "Консультация по требованиям Экологического кодекса РК",
                        "Документальное сопровождение предприятия"),
                List.of("Реквизиты предприятия", "Описание деятельности", "Категория объекта",
                        "Действующие разрешения при наличии", "Проектная и производственная информация"),
                List.of("Определяем требуемый вид разрешения", "Собираем исходные данные",
                        "Готовим пакет документов", "Сопровождаем подачу", "Помогаем отвечать на замечания"),
                "срок зависит от процедуры согласования"));

        ecoServiceRepository.save(buildService("laboratory", "eco-lab",
                "Лабораторные исследования", ServiceCategory.LABORATORY,
                "Проводим лабораторные исследования и замеры с выдачей протоколов.",
                "Предприятиям, которым нужно подтвердить экологическую безопасность, пройти проверки или подготовить документацию.",
                "Протоколы лабораторных исследований и замеров для экологических документов, проверок и внутреннего контроля.",
                List.of("Химический анализ воды", "Химический анализ почвы и грунта",
                        "Анализ атмосферного воздуха", "Анализ сточных и природных вод",
                        "Замеры промышленных выбросов в атмосферу",
                        "Замеры на границе санитарно-защитной зоны — СЗЗ",
                        "Замеры факторов производственной среды",
                        "Замеры выбросов загрязняющих веществ от автотранспорта",
                        "Проведение лабораторных анализов с выдачей протокола"),
                List.of("Описание объекта исследования", "Адрес и точки отбора проб",
                        "Параметры для анализа", "Данные о производственном процессе при необходимости"),
                List.of("Уточняем задачу исследования", "Согласуем перечень анализов и замеров",
                        "Проводим отбор проб или замеры", "Выполняем лабораторный анализ",
                        "Передаем протоколы клиенту"),
                "срок зависит от вида анализа"));

        ecoServiceRepository.save(buildService("waste-management", "eco-waste",
                "Обращение с отходами", ServiceCategory.WASTE,
                "Организуем полный цикл работы с отходами: прием, сбор, вывоз, транспортировку, переработку, утилизацию и безопасное размещение.",
                "Предприятиям, строительным организациям, коммунальным службам и другим клиентам, которым нужен законный цикл обращения с отходами.",
                "Организованный процесс обращения с отходами с соблюдением экологических и санитарных требований.",
                List.of("Прием отходов", "Сбор отходов", "Вывоз отходов",
                        "Транспортировка отходов с оформлением документов",
                        "Переработка отходов", "Утилизация отходов",
                        "Захоронение отходов на полигоне",
                        "Работа с опасными и неопасными отходами",
                        "Документальное сопровождение операций с отходами"),
                List.of("Информация о виде отходов", "Объем или ориентировочная масса",
                        "Адрес забора", "Требования к транспортировке", "Реквизиты заказчика"),
                List.of("Определяем вид и объем отходов", "Согласуем формат работ",
                        "Организуем сбор или прием", "Оформляем сопроводительные документы",
                        "Выполняем переработку, утилизацию или размещение"),
                "по согласованному графику"));

        ecoServiceRepository.save(buildService("waste-transportation", "eco-waste",
                "Транспортировка отходов", ServiceCategory.WASTE,
                "Обеспечиваем экологически безопасную транспортировку отходов специализированным транспортом.",
                "Производственным, строительным, коммунальным и другим организациям, которым нужен вывоз опасных или неопасных отходов.",
                "Безопасная перевозка отходов с необходимой сопроводительной документацией и соблюдением требований безопасности.",
                List.of("Вывоз производственных отходов", "Вывоз строительных отходов",
                        "Вывоз бытовых отходов", "Транспортировка опасных отходов",
                        "Транспортировка неопасных отходов",
                        "Оформление сопроводительной документации",
                        "Организация безопасного маршрута перевозки"),
                List.of("Вид отходов", "Объем партии", "Адрес погрузки и разгрузки",
                        "Особые требования к перевозке", "Контактные данные ответственного лица"),
                List.of("Уточняем характеристики отходов", "Подбираем транспорт",
                        "Оформляем документы", "Согласуем маршрут и график", "Выполняем перевозку"),
                "по согласованному графику"));

        ecoServiceRepository.save(buildService("landfill", "eco-poligon",
                "Полигон и размещение отходов", ServiceCategory.WASTE,
                "Предоставляем услуги по законному и безопасному размещению отходов на лицензированном полигоне.",
                "Предприятиям, строительным организациям, коммунальным службам и населению региона.",
                "Законное размещение или захоронение отходов на полигоне с документальным сопровождением.",
                List.of("Прием отходов на законных основаниях",
                        "Размещение отходов на полигоне",
                        "Захоронение твердых бытовых отходов — ТБО",
                        "Захоронение производственных отходов",
                        "Полное документальное сопровождение",
                        "Контроль соблюдения экологических требований"),
                List.of("Сведения о виде отходов", "Объем или масса", "Данные отправителя",
                        "Сопроводительные документы при наличии"),
                List.of("Проверяем возможность приема отходов", "Согласуем условия",
                        "Принимаем отходы на полигоне", "Оформляем документы",
                        "Контролируем соблюдение требований"),
                "по условиям приема отходов"));

        ecoServiceRepository.save(buildService("enterprise-support", "eco-docs",
                "Услуги для предприятий", ServiceCategory.ENTERPRISE,
                "Комплексное экологическое сопровождение для бизнеса, производственных объектов, строительных компаний, промышленных предприятий и организаций.",
                "Бизнесу, производственным объектам, строительным компаниям, промышленным предприятиям и организациям.",
                "Комплексное сопровождение экологических задач: от анализа требований и документации до разрешений, отчетности и работы с отходами.",
                List.of("Анализ экологических требований для объекта",
                        "Подготовка проектной документации",
                        "Лабораторные замеры и протоколы",
                        "Получение разрешений",
                        "Организация вывоза и утилизации отходов",
                        "Экологическая отчетность",
                        "Консультации по проверкам и требованиям законодательства"),
                List.of("Реквизиты компании", "Описание объекта и деятельности",
                        "Имеющиеся экологические документы",
                        "Данные по отходам, выбросам и сбросам",
                        "Информация о текущих задачах"),
                List.of("Анализируем объект и требования", "Формируем план экологической работы",
                        "Готовим документы и организуем замеры",
                        "Сопровождаем разрешения и операции с отходами",
                        "Помогаем с отчетностью и проверками"),
                "индивидуально под задачи предприятия"));
    }

    private EcoService buildService(String id, String businessCompanyId, String title,
                                    ServiceCategory category, String description,
                                    String forWhom, String result, List<String> includes,
                                    List<String> documents, List<String> workflow, String duration) {
        EcoService s = new EcoService();
        s.setId(id);
        s.setBusinessCompanyId(businessCompanyId);
        s.setTitle(title);
        s.setSlug(id);
        s.setCategory(category);
        s.setDescription(description);
        s.setForWhom(forWhom);
        s.setResult(result);
        s.setIncludes(new ArrayList<>(includes));
        s.setDocuments(new ArrayList<>(documents));
        s.setWorkflow(new ArrayList<>(workflow));
        s.setDuration(duration);
        return s;
    }

    // ── Employees ───────────────────────────────────────────────────────

    private void seedEmployees() {
        if (employeeRepository.count() > 0) return;

        employeeRepository.save(employee("chief", "Главный эколог", "Руководитель экспертного направления",
                "12 лет", "Разрешительная документация и экологическая стратегия",
                "Ведет комплексные проекты, проверяет финальные документы и помогает клиентам снижать регуляторные риски.",
                "/pexels-jan-van.jpg"));
        employeeRepository.save(employee("consultant", "Эколог-консультант", "Специалист по проверкам",
                "8 лет", "Аудит, контроль, подготовка к инспекциям",
                "Переводит сложные требования на понятный язык и сопровождает клиентов на этапах проверки.",
                "/pexels-enginakyurt.jpg"));
        employeeRepository.save(employee("reporting", "Специалист по отчетности", "Эколог-аналитик",
                "6 лет", "Экологическая отчетность и данные",
                "Готовит отчетность, контролирует сроки и помогает выстроить календарь обязательств.",
                "/pexels-jan-van.jpg"));
        employeeRepository.save(employee("manager", "Менеджер ECOPROGRESS GROUP", "Менеджер по работе с клиентами",
                "5 лет", "Клиентское сопровождение",
                "Координирует заявки, статусы, документы и коммуникацию между клиентом и специалистами.",
                "/pexels-enginakyurt.jpg"));
    }

    private Employee employee(String id, String name, String position, String experience,
                              String specialty, String summary, String avatar) {
        Employee e = new Employee();
        e.setId(id);
        e.setName(name);
        e.setPosition(position);
        e.setExperience(experience);
        e.setSpecialty(specialty);
        e.setSummary(summary);
        e.setAvatar(avatar);
        return e;
    }

    // ── News ────────────────────────────────────────────────────────────

    private void seedNews() {
        if (newsRepository.count() > 0) return;

        newsRepository.save(news("reporting-calendar",
                "Как подготовиться к экологической отчетности без спешки",
                "Короткий план: какие данные собрать заранее и как не потерять сроки подачи.",
                "Отчетность", LocalDate.of(2026, 4, 15), "/pexels-jan-van.jpg",
                List.of(
                        "Экологическая отчетность становится проще, если вести календарь обязательств и хранить исходные данные в одном месте.",
                        "ECOPROGRESS GROUP помогает клиентам подготовить формы, проверить комплектность и отслеживать следующий цикл отчетности.")));

        newsRepository.save(news("inspection-ready",
                "Пять шагов подготовки к экологической проверке",
                "Что проверить в документах, журналах и договорах перед визитом инспекции.",
                "Проверки", LocalDate.of(2026, 4, 2), "/pexels-enginakyurt.jpg",
                List.of(
                        "Перед проверкой важно понять перечень обязательных документов и возможные зоны риска.",
                        "Мы начинаем с экспресс-аудита, затем помогаем закрыть пробелы и подготовить пояснения.")));

        newsRepository.save(news("client-cabinet",
                "Кабинет клиента: зачем отслеживать экологические заявки онлайн",
                "Статусы, документы и комментарии специалиста доступны в одном месте.",
                "Сервис", LocalDate.of(2026, 3, 28), "/pexels-jan-van.jpg",
                List.of(
                        "Онлайн-кабинет снижает количество переписок и помогает видеть, что происходит с каждой заявкой.",
                        "Клиент может загрузить документы, написать комментарий и скачать готовый результат.")));
    }

    private News news(String id, String title, String excerpt, String category, LocalDate date,
                      String image, List<String> content) {
        News n = new News();
        n.setId(id);
        n.setTitle(title);
        n.setExcerpt(excerpt);
        n.setCategory(category);
        n.setPublishedAt(date);
        n.setImage(image);
        n.setContent(new ArrayList<>(content));
        return n;
    }

    // ── Tariffs ─────────────────────────────────────────────────────────

    private void seedTariffs() {
        if (tariffRepository.count() > 0) return;

        tariffRepository.save(tariff("start", "Стартовое сопровождение", "от 150 000 ₸",
                "Для ИП, малого бизнеса и разовых экологических задач.",
                "Получить консультацию", TariffMode.ONE_TIME, false, 0,
                List.of("Первичная консультация эколога", "Анализ вашей ситуации и объекта",
                        "Проверка имеющихся документов", "Определение обязательных экологических требований",
                        "Рекомендации по следующим шагам", "Подготовка одной заявки или базового документа")));

        tariffRepository.save(tariff("regular", "Регулярное сопровождение", "от 350 000 ₸ / месяц",
                "Для компаний, которым нужно вести документы, отчетность и несколько экологических задач одновременно.",
                "Выбрать сопровождение", TariffMode.MONTHLY, true, 1,
                List.of("До 3 активных задач в работе", "Экологическая отчетность",
                        "Проверка и подготовка документов", "Сопровождение разрешительной документации",
                        "Консультации специалиста", "Контроль сроков по экологическим обязательствам",
                        "Комментарии специалиста в личном кабинете",
                        "Помощь при взаимодействии с подрядчиками")));

        tariffRepository.save(tariff("full", "Полное сопровождение", "от 650 000 ₸ / месяц",
                "Для предприятий, которым нужно комплексное экологическое сопровождение и контроль рисков.",
                "Заказать полное сопровождение", TariffMode.MONTHLY, false, 2,
                List.of("Полный экологический аудит", "Разработка экологических документов",
                        "Сопровождение разрешений", "Контроль экологической отчетности",
                        "Организация лабораторных исследований",
                        "Организация вывоза и утилизации отходов",
                        "Работа с опасными и неопасными отходами",
                        "Приоритетная обработка заявок", "Подготовка закрывающих документов",
                        "Сопровождение при проверках", "Персональный менеджер")));

        tariffRepository.save(tariff("corporate", "Корпоративный тариф", "Индивидуальный расчет",
                "Для крупных предприятий, нескольких объектов, филиалов, строительных и промышленных компаний.",
                "Запросить расчет", TariffMode.MONTHLY, false, 3,
                List.of("Сопровождение нескольких объектов", "Экологическое проектирование",
                        "Лабораторные замеры по графику", "Программа управления отходами",
                        "Производственный экологический контроль",
                        "Организация транспортировки отходов",
                        "Утилизация, переработка и размещение на полигоне",
                        "Подготовка отчетности", "Сопровождение проверок", "Отдельный план работ и SLA")));
    }

    private Tariff tariff(String id, String name, String price, String description, String cta,
                          TariffMode mode, boolean popular, int sortOrder, List<String> features) {
        Tariff t = new Tariff();
        t.setId(id);
        t.setName(name);
        t.setPrice(price);
        t.setDescription(description);
        t.setCta(cta);
        t.setMode(mode);
        t.setPopular(popular);
        t.setSortOrder(sortOrder);
        t.setFeatures(new ArrayList<>(features));
        return t;
    }

    // ── Orders ──────────────────────────────────────────────────────────

    private void seedOrders() {
        if (orderRepository.count() > 0) return;
        if (clientEntity == null || clientUser == null) return;

        seedOrderDesign();
        seedOrderConsultation();
        seedOrderReady();
        seedOrderAnnual1();
        seedOrderAnnual2();
        seedOrderCompleted();
    }

    private Order newOrder(String id, String businessCompanyId, String serviceId, String serviceName,
                           ContractType contractType, OrderStatus status, String urgency, String comment,
                           LocalDateTime createdAt) {
        Order o = new Order();
        o.setId(id);
        o.setClient(clientEntity);
        o.setCreatedByUser(clientUser);
        o.setBusinessCompanyId(businessCompanyId);
        o.setServiceId(serviceId);
        o.setServiceName(serviceName);
        o.setContactPerson(clientUser.getName());
        o.setPhone(clientUser.getPhone());
        o.setCity(clientUser.getCity());
        o.setContractType(contractType);
        o.setStatus(status);
        o.setUrgency(urgency);
        o.setComment(comment);
        o.setManager(managerUser);
        o.setCreatedAt(createdAt);
        o.setUpdatedAt(createdAt);
        return o;
    }

    private void addDoc(Order o, String name, DocumentType type, DocumentVisibility vis,
                        String status, LocalDateTime uploadedAt) {
        OrderDocument d = new OrderDocument();
        d.setOrder(o);
        d.setName(name);
        d.setType(type);
        d.setVisibility(vis);
        d.setStatus(status);
        d.setUploadedAt(uploadedAt);
        o.getDocuments().add(d);
    }

    private void addComment(Order o, String authorName, String authorRole, String text,
                            CommentVisibility vis, LocalDateTime when) {
        OrderComment c = new OrderComment();
        c.setOrder(o);
        c.setAuthorName(authorName);
        c.setAuthorRole(authorRole);
        c.setText(text);
        c.setVisibility(vis);
        c.setCreatedAt(when);
        o.getComments().add(c);
    }

    private void addHistory(Order o, String text, LocalDateTime when) {
        OrderHistory h = new OrderHistory();
        h.setOrder(o);
        h.setText(text);
        h.setCreatedAt(when);
        o.getHistory().add(h);
    }

    private void seedOrderDesign() {
        LocalDateTime created = LocalDateTime.of(2026, 4, 12, 10, 15);
        Order o = newOrder("ORD-1012", "eco-docs", "eco-design",
                "Экологическое проектирование", ContractType.one_time, OrderStatus.DESIGN,
                "Стандартная", "Нужно разработать проектную документацию для производственной площадки.", created);
        o.setContractStatus(ContractStatus.signed);
        o.setPaymentStatus(PaymentStatus.paid);
        o.setPaymentAmount(new BigDecimal("300000"));
        o.setCrmContractStatus(CrmContractStatus.signed);
        o.setEcologist(ecologistUser);

        addDoc(o, "Исходные данные.xlsx", DocumentType.client, DocumentVisibility.client,
                "Принят", LocalDateTime.of(2026, 4, 12, 12, 0));
        addDoc(o, "Договор №ORD-1012.pdf", DocumentType.contract, DocumentVisibility.client,
                "Подписан", LocalDateTime.of(2026, 4, 13, 10, 0));
        addDoc(o, "Счет на оплату №2201.pdf", DocumentType.invoice, DocumentVisibility.client,
                "Оплачен", LocalDateTime.of(2026, 4, 13, 10, 5));
        addDoc(o, "Черновик проекта РООС.pdf", DocumentType.result, DocumentVisibility.client,
                "На проверке", LocalDateTime.of(2026, 4, 16, 9, 0));

        addComment(o, "Менеджер ECOPROGRESS GROUP", "MANAGER",
                "Документы получили, специалист начал подготовку.",
                CommentVisibility.client, LocalDateTime.of(2026, 4, 12, 16, 20));
        addComment(o, "Эколог ECOPROGRESS GROUP", "ECOLOGIST",
                "Начал работу над проектом РООС, ориентировочный срок — 10 рабочих дней.",
                CommentVisibility.client, LocalDateTime.of(2026, 4, 14, 10, 0));

        addHistory(o, "Заявка создана", LocalDateTime.of(2026, 4, 12, 10, 15));
        addHistory(o, "Менеджер назначен", LocalDateTime.of(2026, 4, 12, 11, 0));
        addHistory(o, "Договор отправлен клиенту", LocalDateTime.of(2026, 4, 13, 10, 0));
        addHistory(o, "Договор подписан", LocalDateTime.of(2026, 4, 13, 14, 0));
        addHistory(o, "Оплата получена", LocalDateTime.of(2026, 4, 13, 16, 0));
        addHistory(o, "Статус изменен на \"Проектирование\"", LocalDateTime.of(2026, 4, 14, 9, 30));

        orderRepository.save(o);
    }

    private void seedOrderConsultation() {
        LocalDateTime created = LocalDateTime.of(2026, 4, 4, 11, 0);
        Order o = newOrder("ORD-1009", "eco-docs", "permits",
                "Разрешительная документация", ContractType.one_time, OrderStatus.CONSULTATION,
                "Не срочно", "Нужен комплект разрешительных документов для площадки.", created);
        o.setContractStatus(ContractStatus.not_sent);
        o.setPaymentStatus(PaymentStatus.not_sent);
        o.setCrmContractStatus(CrmContractStatus.not_created);

        addComment(o, "Менеджер ECOPROGRESS GROUP", "MANAGER",
                "Пожалуйста, загрузите схему площадки и список отходов.",
                CommentVisibility.client, LocalDateTime.of(2026, 4, 5, 11, 10));

        addHistory(o, "Заявка создана", LocalDateTime.of(2026, 4, 4, 11, 0));
        addHistory(o, "Запрошены дополнительные документы", LocalDateTime.of(2026, 4, 5, 11, 10));

        orderRepository.save(o);
    }

    private void seedOrderReady() {
        LocalDateTime created = LocalDateTime.of(2026, 3, 21, 9, 0);
        Order o = newOrder("ORD-1004", "eco-docs", "permits",
                "Подготовка разрешительной документации", ContractType.one_time, OrderStatus.COMPLETED,
                "Срочно", "Нужно проверить пакет разрешений.", created);
        o.setContractStatus(ContractStatus.signed);
        o.setPaymentStatus(PaymentStatus.paid);
        o.setPaymentAmount(new BigDecimal("250000"));
        o.setCrmContractStatus(CrmContractStatus.signed);

        addDoc(o, "Готовый пакет документов.zip", DocumentType.result, DocumentVisibility.client,
                "Готово", LocalDateTime.of(2026, 4, 2, 15, 40));

        addHistory(o, "Заявка создана", LocalDateTime.of(2026, 3, 21, 9, 0));
        addHistory(o, "Статус изменен на \"Анализ заявки\"", LocalDateTime.of(2026, 3, 21, 14, 0));
        addHistory(o, "Статус изменен на \"Проектирование\"", LocalDateTime.of(2026, 3, 25, 10, 0));
        addHistory(o, "Готовый документ загружен", LocalDateTime.of(2026, 4, 2, 15, 40));
        addHistory(o, "Статус изменен на \"Готово\"", LocalDateTime.of(2026, 4, 2, 15, 45));

        orderRepository.save(o);
    }

    private void seedOrderAnnual1() {
        LocalDateTime created = LocalDateTime.of(2026, 1, 10, 9, 0);
        Order o = newOrder("ORD-2001", "eco-docs", "enterprise-support",
                "Комплексное экологическое сопровождение", ContractType.annual_quarterly,
                OrderStatus.ANNUAL_ACTIVE, "Стандартная",
                "Годовое экологическое сопровождение предприятия на 2026 год.", created);
        o.setAnnualPeriodStart(LocalDate.of(2026, 1, 1));
        o.setAnnualPeriodEnd(LocalDate.of(2026, 12, 31));
        o.setContractStatus(ContractStatus.signed);
        o.setPaymentStatus(PaymentStatus.partial);
        o.setPaymentAmount(new BigDecimal("1200000"));
        o.setCrmContractStatus(CrmContractStatus.signed);
        o.setSignatureProvider("NCALayer");
        o.setSignedAt(LocalDateTime.of(2026, 1, 12, 14, 0));
        o.setAccountant(accountantUser);
        o.setEcologist(ecologistUser);

        BigDecimal qAmount = new BigDecimal("300000");

        // Q1 — completed, paid
        OrderQuarter q1 = newQuarter(o, 1, "Q1 2026",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31),
                "Комплексное экологическое сопровождение", "Q1: Аудит и инвентаризация",
                WorkStatus.completed, PaymentStatus.paid,
                qAmount, qAmount, BigDecimal.ZERO);
        q1.setInvoiceNumber("INV-2001-Q1");
        q1.setInvoiceDate(LocalDate.of(2026, 1, 15));
        q1.setDueDate(LocalDate.of(2026, 2, 15));
        q1.setLastPaymentDate(LocalDate.of(2026, 2, 10));
        q1.setResponsibleEmployee(ecologistUser);
        q1.setResponsibleEmployeeName("Эколог ECOPROGRESS GROUP");
        q1.setStartedAt(LocalDateTime.of(2026, 1, 15, 9, 0));
        q1.setCompletedAt(LocalDateTime.of(2026, 3, 28, 17, 0));
        o.getQuarters().add(q1);

        // Q2 — in_progress, paid
        OrderQuarter q2 = newQuarter(o, 2, "Q2 2026",
                LocalDate.of(2026, 4, 1), LocalDate.of(2026, 6, 30),
                "Комплексное экологическое сопровождение", "Q2: Проектирование и замеры",
                WorkStatus.in_progress, PaymentStatus.paid,
                qAmount, qAmount, BigDecimal.ZERO);
        q2.setInvoiceNumber("INV-2001-Q2");
        q2.setInvoiceDate(LocalDate.of(2026, 4, 5));
        q2.setDueDate(LocalDate.of(2026, 5, 5));
        q2.setLastPaymentDate(LocalDate.of(2026, 4, 28));
        q2.setResponsibleEmployee(ecologistUser);
        q2.setResponsibleEmployeeName("Эколог ECOPROGRESS GROUP");
        q2.setStartedAt(LocalDateTime.of(2026, 4, 1, 9, 0));
        o.getQuarters().add(q2);

        // Q3 — planned, unpaid
        OrderQuarter q3 = newQuarter(o, 3, "Q3 2026",
                LocalDate.of(2026, 7, 1), LocalDate.of(2026, 9, 30),
                "Комплексное экологическое сопровождение", "Q3: Разрешения и отчетность",
                WorkStatus.planned, PaymentStatus.unpaid,
                qAmount, BigDecimal.ZERO, qAmount);
        q3.setInvoiceNumber("INV-2001-Q3");
        q3.setInvoiceDate(LocalDate.of(2026, 7, 1));
        q3.setDueDate(LocalDate.of(2026, 8, 1));
        o.getQuarters().add(q3);

        // Q4 — planned, unpaid
        OrderQuarter q4 = newQuarter(o, 4, "Q4 2026",
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31),
                "Комплексное экологическое сопровождение", "Q4: Итоговый контроль",
                WorkStatus.planned, PaymentStatus.unpaid,
                qAmount, BigDecimal.ZERO, qAmount);
        q4.setInvoiceNumber("INV-2001-Q4");
        q4.setInvoiceDate(LocalDate.of(2026, 10, 1));
        q4.setDueDate(LocalDate.of(2026, 11, 1));
        o.getQuarters().add(q4);

        addDoc(o, "Договор годового сопровождения №2001.pdf", DocumentType.contract,
                DocumentVisibility.client, "Подписан", LocalDateTime.of(2026, 1, 12, 14, 0));
        addDoc(o, "Отчет Q1 — Аудит и инвентаризация.pdf", DocumentType.result,
                DocumentVisibility.client, "Готово", LocalDateTime.of(2026, 3, 28, 17, 0));

        addComment(o, "Менеджер ECOPROGRESS GROUP", "MANAGER",
                "Договор подписан, работы по Q1 начнем с 15 января.",
                CommentVisibility.client, LocalDateTime.of(2026, 1, 12, 15, 0));
        addComment(o, "Эколог ECOPROGRESS GROUP", "ECOLOGIST",
                "Q1 завершен — отчет по инвентаризации загружен.",
                CommentVisibility.client, LocalDateTime.of(2026, 3, 28, 17, 10));
        addComment(o, "Менеджер ECOPROGRESS GROUP", "MANAGER",
                "Работы по Q2 начаты, план: проектирование + лабораторные замеры.",
                CommentVisibility.client, LocalDateTime.of(2026, 4, 1, 10, 0));

        addHistory(o, "Заявка создана", created);
        addHistory(o, "Договор подписан", LocalDateTime.of(2026, 1, 12, 14, 0));
        addHistory(o, "Q1 начат", LocalDateTime.of(2026, 1, 15, 9, 0));
        addHistory(o, "Оплата Q1 получена", LocalDateTime.of(2026, 2, 10, 12, 0));
        addHistory(o, "Q1 завершен", LocalDateTime.of(2026, 3, 28, 17, 0));
        addHistory(o, "Q2 начат", LocalDateTime.of(2026, 4, 1, 9, 0));
        addHistory(o, "Оплата Q2 получена", LocalDateTime.of(2026, 4, 28, 14, 0));

        orderRepository.save(o);
    }

    private void seedOrderAnnual2() {
        LocalDateTime created = LocalDateTime.of(2026, 2, 1, 10, 0);
        Order o = newOrder("ORD-2002", "eco-waste", "waste-management",
                "Обращение с отходами (годовое)", ContractType.annual_quarterly,
                OrderStatus.ANNUAL_ACTIVE, "Стандартная",
                "Годовой договор на вывоз и утилизацию отходов на 2026 год.", created);
        o.setAnnualPeriodStart(LocalDate.of(2026, 1, 1));
        o.setAnnualPeriodEnd(LocalDate.of(2026, 12, 31));
        o.setContractStatus(ContractStatus.signed);
        o.setPaymentStatus(PaymentStatus.unpaid);
        o.setPaymentAmount(new BigDecimal("800000"));
        o.setCrmContractStatus(CrmContractStatus.signed);
        o.setSignatureProvider("NCALayer");
        o.setSignedAt(LocalDateTime.of(2026, 2, 5, 11, 0));

        BigDecimal qAmount = new BigDecimal("200000");

        for (int q = 1; q <= 4; q++) {
            String label = "Q" + q + " 2026";
            LocalDate start = LocalDate.of(2026, (q - 1) * 3 + 1, 1);
            LocalDate end = start.plusMonths(3).minusDays(1);
            OrderQuarter oq = newQuarter(o, q, label, start, end,
                    "Обращение с отходами", "Вывоз и утилизация — " + label,
                    WorkStatus.planned, PaymentStatus.unpaid,
                    qAmount, BigDecimal.ZERO, qAmount);
            oq.setInvoiceNumber("INV-2002-Q" + q);
            oq.setInvoiceDate(start);
            oq.setDueDate(start.plusMonths(1));
            o.getQuarters().add(oq);
        }

        addDoc(o, "Договор на обращение с отходами №2002.pdf", DocumentType.contract,
                DocumentVisibility.client, "Подписан", LocalDateTime.of(2026, 2, 5, 11, 0));

        addHistory(o, "Заявка создана", created);
        addHistory(o, "Договор подписан", LocalDateTime.of(2026, 2, 5, 11, 0));

        orderRepository.save(o);
    }

    private void seedOrderCompleted() {
        LocalDateTime created = LocalDateTime.of(2026, 2, 15, 14, 0);
        Order o = newOrder("ORD-1015", "eco-lab", "laboratory",
                "Лабораторные исследования", ContractType.one_time, OrderStatus.COMPLETED,
                "Срочно", "Нужны протоколы анализа воздуха для объекта.", created);
        o.setContractStatus(ContractStatus.signed);
        o.setPaymentStatus(PaymentStatus.paid);
        o.setPaymentAmount(new BigDecimal("180000"));
        o.setCrmContractStatus(CrmContractStatus.signed);
        o.setCompletedAt(LocalDateTime.of(2026, 3, 10, 16, 0));
        o.setLaboratoryUser(labUser);

        addDoc(o, "Протоколы анализа воздуха.pdf", DocumentType.result, DocumentVisibility.client,
                "Готово", LocalDateTime.of(2026, 3, 8, 14, 0));

        addHistory(o, "Заявка создана", created);
        addHistory(o, "Статус изменен на \"Лаборатория\"", LocalDateTime.of(2026, 2, 18, 10, 0));
        addHistory(o, "Протоколы загружены", LocalDateTime.of(2026, 3, 8, 14, 0));
        addHistory(o, "Статус изменен на \"Завершено\"", LocalDateTime.of(2026, 3, 10, 16, 0));

        orderRepository.save(o);
    }

    private OrderQuarter newQuarter(Order order, int quarter, String label,
                                    LocalDate start, LocalDate end,
                                    String serviceName, String workStage,
                                    WorkStatus workStatus, PaymentStatus paymentStatus,
                                    BigDecimal planned, BigDecimal paid, BigDecimal remaining) {
        OrderQuarter q = new OrderQuarter();
        q.setOrder(order);
        q.setQuarter(quarter);
        q.setQuarterLabel(label);
        q.setPeriodStart(start);
        q.setPeriodEnd(end);
        q.setServiceName(serviceName);
        q.setWorkStage(workStage);
        q.setWorkStatus(workStatus);
        q.setPaymentStatus(paymentStatus);
        q.setPlannedAmount(planned);
        q.setPaidAmount(paid);
        q.setRemainingAmount(remaining);
        return q;
    }

    // ── Contracts ───────────────────────────────────────────────────────

    private void seedContracts() {
        if (contractRepository.count() > 0) return;
        if (clientEntity == null) return;

        Order ord2001 = orderRepository.findById("ORD-2001").orElse(null);
        Order ord2002 = orderRepository.findById("ORD-2002").orElse(null);

        if (ord2001 != null) {
            Contract c1 = new Contract();
            c1.setOrderId("ORD-2001");
            c1.setClient(clientEntity);
            c1.setBusinessCompanyId("eco-docs");
            c1.setContractNumber("ECO-2026-001");
            c1.setContractType("annual_quarterly");
            c1.setStatus("signed");
            c1.setCrmStatus(CrmContractStatus.signed);
            c1.setStartsAt(LocalDate.of(2026, 1, 1));
            c1.setEndsAt(LocalDate.of(2026, 12, 31));
            c1.setSignatureProvider("NCALayer");
            c1.setSignedAt(LocalDateTime.of(2026, 1, 12, 14, 0));
            c1.setResponsibleManager(managerUser);

            BigDecimal qAmt = new BigDecimal("300000");

            ContractQuarter cq1 = contractQuarter(c1, "ORD-2001", 1, "Q1 2026",
                    LocalDate.of(2026, 1, 1), LocalDate.of(2026, 3, 31),
                    "Комплексное экологическое сопровождение", "Q1: Аудит и инвентаризация",
                    qAmt, qAmt, BigDecimal.ZERO, PaymentStatus.paid, WorkStatus.completed);
            cq1.setInvoiceNumber("INV-2001-Q1");
            cq1.setInvoiceDate(LocalDate.of(2026, 1, 15));
            cq1.setDueDate(LocalDate.of(2026, 2, 15));
            cq1.setLastPaymentDate(LocalDate.of(2026, 2, 10));
            cq1.setCompletedAt(LocalDateTime.of(2026, 3, 28, 17, 0));
            c1.getQuarters().add(cq1);

            ContractQuarter cq2 = contractQuarter(c1, "ORD-2001", 2, "Q2 2026",
                    LocalDate.of(2026, 4, 1), LocalDate.of(2026, 6, 30),
                    "Комплексное экологическое сопровождение", "Q2: Проектирование и замеры",
                    qAmt, qAmt, BigDecimal.ZERO, PaymentStatus.paid, WorkStatus.in_progress);
            cq2.setInvoiceNumber("INV-2001-Q2");
            cq2.setInvoiceDate(LocalDate.of(2026, 4, 5));
            cq2.setDueDate(LocalDate.of(2026, 5, 5));
            cq2.setLastPaymentDate(LocalDate.of(2026, 4, 28));
            c1.getQuarters().add(cq2);

            ContractQuarter cq3 = contractQuarter(c1, "ORD-2001", 3, "Q3 2026",
                    LocalDate.of(2026, 7, 1), LocalDate.of(2026, 9, 30),
                    "Комплексное экологическое сопровождение", "Q3: Разрешения и отчетность",
                    qAmt, BigDecimal.ZERO, qAmt, PaymentStatus.unpaid, WorkStatus.planned);
            cq3.setInvoiceNumber("INV-2001-Q3");
            cq3.setInvoiceDate(LocalDate.of(2026, 7, 1));
            cq3.setDueDate(LocalDate.of(2026, 8, 1));
            c1.getQuarters().add(cq3);

            ContractQuarter cq4 = contractQuarter(c1, "ORD-2001", 4, "Q4 2026",
                    LocalDate.of(2026, 10, 1), LocalDate.of(2026, 12, 31),
                    "Комплексное экологическое сопровождение", "Q4: Итоговый контроль",
                    qAmt, BigDecimal.ZERO, qAmt, PaymentStatus.unpaid, WorkStatus.planned);
            cq4.setInvoiceNumber("INV-2001-Q4");
            cq4.setInvoiceDate(LocalDate.of(2026, 10, 1));
            cq4.setDueDate(LocalDate.of(2026, 11, 1));
            c1.getQuarters().add(cq4);

            c1.recalcTotals();
            Contract saved1 = contractRepository.save(c1);

            ord2001.setContractId(saved1.getId());
            for (int i = 0; i < ord2001.getQuarters().size(); i++) {
                ord2001.getQuarters().get(i).setContractId(saved1.getId());
            }
            orderRepository.save(ord2001);
        }

        if (ord2002 != null) {
            Contract c2 = new Contract();
            c2.setOrderId("ORD-2002");
            c2.setClient(clientEntity);
            c2.setBusinessCompanyId("eco-waste");
            c2.setContractNumber("ECO-2026-002");
            c2.setContractType("annual_quarterly");
            c2.setStatus("signed");
            c2.setCrmStatus(CrmContractStatus.signed);
            c2.setStartsAt(LocalDate.of(2026, 1, 1));
            c2.setEndsAt(LocalDate.of(2026, 12, 31));
            c2.setSignatureProvider("NCALayer");
            c2.setSignedAt(LocalDateTime.of(2026, 2, 5, 11, 0));
            c2.setResponsibleManager(managerUser);

            BigDecimal qAmt = new BigDecimal("200000");
            for (int q = 1; q <= 4; q++) {
                LocalDate start = LocalDate.of(2026, (q - 1) * 3 + 1, 1);
                LocalDate end = start.plusMonths(3).minusDays(1);
                ContractQuarter cq = contractQuarter(c2, "ORD-2002", q, "Q" + q + " 2026",
                        start, end, "Обращение с отходами", "Вывоз и утилизация — Q" + q + " 2026",
                        qAmt, BigDecimal.ZERO, qAmt, PaymentStatus.unpaid, WorkStatus.planned);
                cq.setInvoiceNumber("INV-2002-Q" + q);
                cq.setInvoiceDate(start);
                cq.setDueDate(start.plusMonths(1));
                c2.getQuarters().add(cq);
            }

            c2.recalcTotals();
            Contract saved2 = contractRepository.save(c2);

            ord2002.setContractId(saved2.getId());
            for (int i = 0; i < ord2002.getQuarters().size(); i++) {
                ord2002.getQuarters().get(i).setContractId(saved2.getId());
            }
            orderRepository.save(ord2002);
        }
    }

    private ContractQuarter contractQuarter(Contract contract, String orderId, int quarter,
                                            String label, LocalDate start, LocalDate end,
                                            String serviceName, String workStage,
                                            BigDecimal planned, BigDecimal paid, BigDecimal remaining,
                                            PaymentStatus payStatus, WorkStatus workStatus) {
        ContractQuarter cq = new ContractQuarter();
        cq.setContract(contract);
        cq.setOrderId(orderId);
        cq.setQuarter(quarter);
        cq.setQuarterLabel(label);
        cq.setPeriodStart(start);
        cq.setPeriodEnd(end);
        cq.setServiceName(serviceName);
        cq.setWorkStage(workStage);
        cq.setPlannedAmount(planned);
        cq.setPaidAmount(paid);
        cq.setRemainingAmount(remaining);
        cq.setPaymentStatus(payStatus);
        cq.setWorkStatus(workStatus);
        return cq;
    }

    // ── Payments ────────────────────────────────────────────────────────

    private void seedPayments() {
        if (paymentRepository.count() > 0) return;

        // Payment for ORD-1012 (eco-design, one-time, paid)
        Payment p1 = new Payment();
        p1.setOrderId("ORD-1012");
        p1.setInvoiceNumber("INV-1012");
        p1.setServiceName("Экологическое проектирование");
        p1.setTotalAmount(new BigDecimal("300000"));
        p1.setPaidAmount(new BigDecimal("300000"));
        p1.setRemainingAmount(BigDecimal.ZERO);
        p1.setPaymentStatus(PaymentStatus.paid);
        p1.setPaymentMethod("Банковский перевод");
        p1.setInvoiceDate(LocalDate.of(2026, 4, 13));
        p1.setDueDate(LocalDate.of(2026, 4, 27));
        p1.setLastPaymentDate(LocalDate.of(2026, 4, 13));
        p1.setClientEmail("client@ecoprogress.kz");
        paymentRepository.save(p1);

        // Payment for ORD-1004 (permits, one-time, paid)
        Payment p2 = new Payment();
        p2.setOrderId("ORD-1004");
        p2.setInvoiceNumber("INV-1004");
        p2.setServiceName("Подготовка разрешительной документации");
        p2.setTotalAmount(new BigDecimal("250000"));
        p2.setPaidAmount(new BigDecimal("250000"));
        p2.setRemainingAmount(BigDecimal.ZERO);
        p2.setPaymentStatus(PaymentStatus.paid);
        p2.setPaymentMethod("Банковский перевод");
        p2.setInvoiceDate(LocalDate.of(2026, 3, 22));
        p2.setDueDate(LocalDate.of(2026, 4, 5));
        p2.setLastPaymentDate(LocalDate.of(2026, 3, 25));
        p2.setClientEmail("client@ecoprogress.kz");
        paymentRepository.save(p2);

        // Payment for ORD-1015 (laboratory, one-time, paid)
        Payment p3 = new Payment();
        p3.setOrderId("ORD-1015");
        p3.setInvoiceNumber("INV-1015");
        p3.setServiceName("Лабораторные исследования");
        p3.setTotalAmount(new BigDecimal("180000"));
        p3.setPaidAmount(new BigDecimal("180000"));
        p3.setRemainingAmount(BigDecimal.ZERO);
        p3.setPaymentStatus(PaymentStatus.paid);
        p3.setPaymentMethod("Банковский перевод");
        p3.setInvoiceDate(LocalDate.of(2026, 2, 16));
        p3.setDueDate(LocalDate.of(2026, 3, 2));
        p3.setLastPaymentDate(LocalDate.of(2026, 2, 20));
        p3.setClientEmail("client@ecoprogress.kz");
        paymentRepository.save(p3);

        // Quarterly payment for ORD-2001, Q1 (paid)
        Contract c1 = contractRepository.findByOrderId("ORD-2001").orElse(null);
        if (c1 != null) {
            Payment pq1 = new Payment();
            pq1.setOrderId("ORD-2001");
            pq1.setContractId(c1.getId());
            pq1.setInvoiceNumber("INV-2001-Q1");
            pq1.setServiceName("Комплексное экологическое сопровождение — Q1 2026");
            pq1.setTotalAmount(new BigDecimal("300000"));
            pq1.setPaidAmount(new BigDecimal("300000"));
            pq1.setRemainingAmount(BigDecimal.ZERO);
            pq1.setPaymentStatus(PaymentStatus.paid);
            pq1.setPaymentMethod("Банковский перевод");
            pq1.setInvoiceDate(LocalDate.of(2026, 1, 15));
            pq1.setDueDate(LocalDate.of(2026, 2, 15));
            pq1.setLastPaymentDate(LocalDate.of(2026, 2, 10));
            pq1.setClientEmail("client@ecoprogress.kz");
            paymentRepository.save(pq1);

            Payment pq2 = new Payment();
            pq2.setOrderId("ORD-2001");
            pq2.setContractId(c1.getId());
            pq2.setInvoiceNumber("INV-2001-Q2");
            pq2.setServiceName("Комплексное экологическое сопровождение — Q2 2026");
            pq2.setTotalAmount(new BigDecimal("300000"));
            pq2.setPaidAmount(new BigDecimal("300000"));
            pq2.setRemainingAmount(BigDecimal.ZERO);
            pq2.setPaymentStatus(PaymentStatus.paid);
            pq2.setPaymentMethod("Банковский перевод");
            pq2.setInvoiceDate(LocalDate.of(2026, 4, 5));
            pq2.setDueDate(LocalDate.of(2026, 5, 5));
            pq2.setLastPaymentDate(LocalDate.of(2026, 4, 28));
            pq2.setClientEmail("client@ecoprogress.kz");
            paymentRepository.save(pq2);
        }
    }

    // ── Debts ───────────────────────────────────────────────────────────

    private void seedDebts() {
        if (debtRepository.count() > 0) return;

        Contract c2 = contractRepository.findByOrderId("ORD-2002").orElse(null);
        if (c2 == null) return;

        ContractQuarter cqQ1 = c2.getQuarters().stream()
                .filter(q -> q.getQuarter() == 1).findFirst().orElse(null);
        if (cqQ1 == null) return;

        Debt d1 = new Debt();
        d1.setOrderId("ORD-2002");
        d1.setContractId(c2.getId());
        d1.setContractQuarterId(cqQ1.getId());
        d1.setInvoiceNumber("INV-2002-Q1");
        d1.setQuarterLabel("Q1 2026");
        d1.setAmount(new BigDecimal("200000"));
        d1.setPaidAmount(BigDecimal.ZERO);
        d1.setRemainingAmount(new BigDecimal("200000"));
        d1.setStatus(DebtStatus.overdue);
        d1.setReason("Просрочка оплаты Q1");
        d1.setDueDate(LocalDate.of(2026, 2, 1));
        d1.setComment("Клиент не оплатил счет за Q1 в срок");
        d1.setClientEmail("client@ecoprogress.kz");
        debtRepository.save(d1);

        ContractQuarter cqQ2 = c2.getQuarters().stream()
                .filter(q -> q.getQuarter() == 2).findFirst().orElse(null);
        if (cqQ2 == null) return;

        Debt d2 = new Debt();
        d2.setOrderId("ORD-2002");
        d2.setContractId(c2.getId());
        d2.setContractQuarterId(cqQ2.getId());
        d2.setInvoiceNumber("INV-2002-Q2");
        d2.setQuarterLabel("Q2 2026");
        d2.setAmount(new BigDecimal("200000"));
        d2.setPaidAmount(BigDecimal.ZERO);
        d2.setRemainingAmount(new BigDecimal("200000"));
        d2.setStatus(DebtStatus.active);
        d2.setReason("Ожидание оплаты Q2");
        d2.setDueDate(LocalDate.of(2026, 5, 1));
        d2.setClientEmail("client@ecoprogress.kz");
        debtRepository.save(d2);
    }

    // ── Notifications ───────────────────────────────────────────────────

    private void seedNotifications() {
        if (notificationRepository.count() > 0) return;

        Notification n1 = new Notification();
        n1.setUserId(clientUser != null ? clientUser.getId() : null);
        n1.setRole("CLIENT");
        n1.setOrderId("ORD-1012");
        n1.setTitle("Комментарий по заявке ORD-1012");
        n1.setMessage("Специалист добавил уточнение по исходным данным.");
        n1.setType("comment");
        n1.setRead(false);
        n1.setCreatedAt(LocalDateTime.now().minusHours(3));
        notificationRepository.save(n1);

        Notification n2 = new Notification();
        n2.setUserId(managerUser != null ? managerUser.getId() : null);
        n2.setRole("MANAGER");
        n2.setOrderId("ORD-1009");
        n2.setTitle("Новая заявка ожидает обработки");
        n2.setMessage("Проверьте входящие заявки в CRM сотрудника.");
        n2.setType("order");
        n2.setRead(false);
        n2.setCreatedAt(LocalDateTime.now().minusHours(2));
        notificationRepository.save(n2);

        Notification n3 = new Notification();
        n3.setUserId(clientUser != null ? clientUser.getId() : null);
        n3.setRole("CLIENT");
        n3.setOrderId("ORD-1004");
        n3.setTitle("Документ готов");
        n3.setMessage("По заявке ORD-1004 загружен готовый пакет.");
        n3.setType("document");
        n3.setRead(false);
        n3.setCreatedAt(LocalDateTime.of(2026, 4, 2, 15, 45));
        notificationRepository.save(n3);
    }
}
