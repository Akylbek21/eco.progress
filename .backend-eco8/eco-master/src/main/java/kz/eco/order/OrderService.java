package kz.eco.order;

import kz.eco.audit.AuditLogService;
import kz.eco.client.Client;
import kz.eco.client.ClientRepository;
import kz.eco.common.exception.BadRequestException;
import kz.eco.common.exception.NotFoundException;
import kz.eco.common.exception.UnauthorizedException;
import kz.eco.contract.Contract;
import kz.eco.contract.ContractQuarter;
import kz.eco.contract.ContractQuarterRepository;
import kz.eco.contract.ContractRepository;
import kz.eco.notification.NotificationService;
import kz.eco.order.dto.*;
import kz.eco.payment.*;
import kz.eco.protocol.Protocol;
import kz.eco.protocol.ProtocolRepository;
import kz.eco.protocol.ProtocolStatus;
import kz.eco.services.EcoService;
import kz.eco.services.EcoServiceRepository;
import kz.eco.mail.MailNotificationService;
import kz.eco.signature.CmsSignatureValidator;
import kz.eco.storage.FileStorageService;
import kz.eco.storage.StoredFileMetadata;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import kz.eco.user.UserRole;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderDocumentRepository documentRepository;
    private final OrderCommentRepository commentRepository;
    private final OrderHistoryRepository historyRepository;
    private final OrderQuarterRepository quarterRepository;
    private final EcoServiceRepository ecoServiceRepository;
    private final FileStorageService fileStorageService;
    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final ContractRepository contractRepository;
    private final ContractQuarterRepository contractQuarterRepository;
    private final PaymentRepository paymentRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final DebtRepository debtRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final OrderPrimaryDocumentRepository primaryDocumentRepository;
    private final LaboratoryMeasurementAgreementRepository measurementAgreementRepository;
    private final LaboratoryResultDocumentRepository labResultDocumentRepository;
    private final AgreementResponseRepository agreementResponseRepository;
    private final MailNotificationService mailNotificationService;
    private final CmsSignatureValidator cmsSignatureValidator;
    private final ProtocolRepository protocolRepository;

    public OrderService(OrderRepository orderRepository,
                        OrderDocumentRepository documentRepository,
                        OrderCommentRepository commentRepository,
                        OrderHistoryRepository historyRepository,
                        OrderQuarterRepository quarterRepository,
                        EcoServiceRepository ecoServiceRepository,
                        FileStorageService fileStorageService,
                        ClientRepository clientRepository,
                        UserRepository userRepository,
                        ContractRepository contractRepository,
                        ContractQuarterRepository contractQuarterRepository,
                        PaymentRepository paymentRepository,
                        PaymentTransactionRepository paymentTransactionRepository,
                        DebtRepository debtRepository,
                        AuditLogService auditLogService,
                        NotificationService notificationService,
                        OrderPrimaryDocumentRepository primaryDocumentRepository,
                        LaboratoryMeasurementAgreementRepository measurementAgreementRepository,
                        LaboratoryResultDocumentRepository labResultDocumentRepository,
                        AgreementResponseRepository agreementResponseRepository,
                        MailNotificationService mailNotificationService,
                        CmsSignatureValidator cmsSignatureValidator,
                        ProtocolRepository protocolRepository) {
        this.orderRepository = orderRepository;
        this.documentRepository = documentRepository;
        this.commentRepository = commentRepository;
        this.historyRepository = historyRepository;
        this.quarterRepository = quarterRepository;
        this.ecoServiceRepository = ecoServiceRepository;
        this.fileStorageService = fileStorageService;
        this.clientRepository = clientRepository;
        this.userRepository = userRepository;
        this.contractRepository = contractRepository;
        this.contractQuarterRepository = contractQuarterRepository;
        this.paymentRepository = paymentRepository;
        this.paymentTransactionRepository = paymentTransactionRepository;
        this.debtRepository = debtRepository;
        this.auditLogService = auditLogService;
        this.notificationService = notificationService;
        this.primaryDocumentRepository = primaryDocumentRepository;
        this.measurementAgreementRepository = measurementAgreementRepository;
        this.labResultDocumentRepository = labResultDocumentRepository;
        this.agreementResponseRepository = agreementResponseRepository;
        this.mailNotificationService = mailNotificationService;
        this.cmsSignatureValidator = cmsSignatureValidator;
        this.protocolRepository = protocolRepository;
    }

    // ── Queries ──

    @Transactional(readOnly = true)
    public List<OrderResponse> findClientOrders(User user) {
        Client client = requireClient(user);
        List<Order> orders = orderRepository.findByClientIdOrderByCreatedAtDesc(client.getId());
        return orders.stream()
                .map(o -> OrderResponse.from(o, true,
                        contractRepository.findByOrderId(o.getId()).orElse(null),
                        primaryDocumentRepository.findByOrderIdAndDocumentGroup(o.getId(), "order")))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> findAllOrders(String q, String businessCompanyId, String status,
                                              String paymentStatus, String contractType,
                                              Long managerId, LocalDate dateFrom, LocalDate dateTo) {
        Specification<Order> spec = (root, cq, cb) -> cb.conjunction();

        if (q != null && !q.isBlank()) {
            String like = "%" + q.toLowerCase() + "%";
            spec = spec.and((root, cq, cb) -> cb.or(
                    cb.like(cb.lower(root.get("id")), like),
                    cb.like(cb.lower(root.get("serviceName")), like),
                    cb.like(cb.lower(root.get("contactPerson")), like)
            ));
        }
        if (businessCompanyId != null && !businessCompanyId.isBlank()) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("businessCompanyId"), businessCompanyId));
        }
        if (status != null && !status.isBlank()) {
            OrderStatus os = OrderStatus.normalize(status);
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("status"), os));
        }
        if (paymentStatus != null && !paymentStatus.isBlank()) {
            PaymentStatus ps = PaymentStatus.valueOf(paymentStatus);
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("paymentStatus"), ps));
        }
        if (contractType != null && !contractType.isBlank()) {
            ContractType ct = ContractType.valueOf(contractType);
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("contractType"), ct));
        }
        if (managerId != null) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("manager").get("id"), managerId));
        }
        if (dateFrom != null) {
            spec = spec.and((root, cq, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), dateFrom.atStartOfDay()));
        }
        if (dateTo != null) {
            spec = spec.and((root, cq, cb) -> cb.lessThan(root.get("createdAt"), dateTo.plusDays(1).atStartOfDay()));
        }

        return orderRepository.findAll(spec, org.springframework.data.domain.Sort.by(
                org.springframework.data.domain.Sort.Direction.DESC, "createdAt")).stream()
                .map(o -> OrderResponse.from(o, false,
                        contractRepository.findByOrderId(o.getId()).orElse(null),
                        primaryDocumentRepository.findByOrderIdAndDocumentGroup(o.getId(), "order")))
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(String id, User user) {
        Order order = getOrThrow(id);
        boolean isClient = !isStaff(user);
        if (isClient) {
            ensureClientOwns(order, user);
        }
        List<OrderPrimaryDocument> primaryDocs =
                primaryDocumentRepository.findByOrderIdAndDocumentGroup(id, "order");
        Contract contract = contractRepository.findByOrderId(id).orElse(null);
        return OrderResponse.from(order, isClient, contract, primaryDocs);
    }

    @Transactional(readOnly = true)
    public List<QuarterResponse> getQuarters(String orderId, User user) {
        Order order = getOrThrow(orderId);
        boolean isClient = !isStaff(user);
        if (isClient) ensureClientOwns(order, user);
        return order.getQuarters().stream()
                .map(q -> QuarterResponse.from(q, isClient, order.getComments()))
                .toList();
    }

    @Transactional(readOnly = true)
    public QuarterResponse getQuarterDetail(String orderId, Long quarterId, User user) {
        Order order = getOrThrow(orderId);
        boolean isClient = !isStaff(user);
        if (isClient) ensureClientOwns(order, user);
        OrderQuarter oq = order.getQuarters().stream()
                .filter(q -> q.getId().equals(quarterId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Квартал не найден"));
        return QuarterResponse.from(oq, isClient, order.getComments());
    }

    // ── Create ──

    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request, User user) {
        Client client = requireClient(user);

        Order order = new Order();
        order.setId(generateOrderId());
        order.setClient(client);
        order.setCreatedByUser(user);

        Optional<EcoService> ecoSvc = ecoServiceRepository.findById(request.serviceId());
        order.setServiceId(request.serviceId());
        order.setServiceName(ecoSvc.map(EcoService::getTitle).orElse(request.serviceId()));
        if (ecoSvc.isPresent()) {
            order.setBusinessCompanyId(ecoSvc.get().getBusinessCompanyId());
        }

        order.setContactPerson(orBlank(request.contactPerson(), client.getContactPerson()));
        order.setPhone(orBlank(request.phone(), client.getPhone()));
        order.setCity(orBlank(request.city(), user.getCity()));
        order.setObjectAddress(request.objectAddress());
        order.setComment(request.comment());
        order.setUrgency(orBlank(request.urgency(), "Стандартная"));

        ContractType ct = request.contractType() != null
                ? ContractType.valueOf(request.contractType())
                : ContractType.one_time;
        order.setContractType(ct);
        order.setStatus(OrderStatus.CONSULTATION);
        order.setContractStatus(ContractStatus.not_sent);
        order.setPaymentStatus(PaymentStatus.not_sent);
        order.setCrmContractStatus(CrmContractStatus.not_created);
        order.setSignatureProvider(orBlank(request.signatureProvider(), "NCALayer / ЭЦП"));
        order.setPaymentMethod(orBlank(request.paymentMethod(), "Банковская карта"));

        orderRepository.save(order);

        if (request.fileName() != null && !request.fileName().isBlank()) {
            attachDocument(order, request.fileName(), DocumentType.client, DocumentVisibility.client, "Загружен", user);
        }

        appendHistory(order, "Заявка ожидает проверки сотрудником");
        appendHistory(order, "Заявка создана");

        if (ct == ContractType.annual_quarterly) {
            createAnnualStructure(order, client, user);
        }

        auditLogService.log("Order", null, order.getId(), user, "CREATE", null, order.getStatus().name(), null);

        notificationService.notify(null, UserRole.MANAGER.name(), order.getId(),
                "Новая заявка " + order.getId(),
                "Клиент " + order.getContactPerson() + " создал заявку: " + order.getServiceName(), "new_order");
        mailNotificationService.onOrderCreated(order);

        Contract contract = contractRepository.findByOrderId(order.getId()).orElse(null);
        return OrderResponse.from(order, true, contract);
    }

    @Transactional
    public OrderResponse createOrderByStaff(StaffCreateOrderRequest request, User staffUser) {
        Client client = clientRepository.findById(request.clientId())
                .orElseThrow(() -> new NotFoundException("Клиент не найден: " + request.clientId()));

        Order order = new Order();
        order.setId(generateOrderId());
        order.setClient(client);
        order.setCreatedByUser(staffUser);

        String serviceId = request.serviceId();
        String serviceName = request.serviceName();
        if (serviceId != null && !serviceId.isBlank()) {
            Optional<EcoService> ecoSvc = ecoServiceRepository.findById(serviceId);
            order.setServiceId(serviceId);
            order.setServiceName(ecoSvc.map(EcoService::getTitle).orElse(serviceName != null ? serviceName : serviceId));
            if (ecoSvc.isPresent()) {
                order.setBusinessCompanyId(ecoSvc.get().getBusinessCompanyId());
            }
        } else {
            order.setServiceName(serviceName != null ? serviceName : "Не указана");
        }

        if (request.businessCompanyId() != null && !request.businessCompanyId().isBlank()) {
            order.setBusinessCompanyId(request.businessCompanyId());
        }

        order.setContactPerson(orBlank(request.contactPerson(), client.getContactPerson()));
        order.setPhone(orBlank(request.phone(), client.getPhone()));
        order.setCity(request.city());
        order.setComment(request.comment());
        order.setUrgency(orBlank(request.urgency(), "Стандартная"));

        ContractType ct = request.contractType() != null
                ? ContractType.valueOf(request.contractType())
                : ContractType.one_time;
        order.setContractType(ct);
        order.setStatus(OrderStatus.CONSULTATION);
        order.setContractStatus(ContractStatus.not_sent);
        order.setPaymentStatus(PaymentStatus.not_sent);
        order.setCrmContractStatus(CrmContractStatus.not_created);

        order.setManager(staffUser);

        orderRepository.save(order);

        appendHistory(order, "Заявка создана сотрудником");

        if (ct == ContractType.annual_quarterly) {
            createAnnualStructure(order, client, staffUser);
        }

        auditLogService.log("Order", null, order.getId(), staffUser, "CREATE_BY_STAFF", null, order.getStatus().name(), null);

        Contract contract = contractRepository.findByOrderId(order.getId()).orElse(null);
        return OrderResponse.from(order, false, contract);
    }

    // ── Status / Assignment ──

    @Transactional
    public OrderResponse updateStatus(String orderId, String statusRaw, User actor) {
        Order order = getOrThrow(orderId);
        OrderStatus oldStatus = order.getStatus();
        OrderStatus newStatus = OrderStatus.normalize(statusRaw);
        validateStatusTransition(order, newStatus);
        order.setStatus(newStatus);

        if (newStatus == OrderStatus.COMPLETED) {
            order.setCompletedAt(LocalDateTime.now());
        } else if (newStatus == OrderStatus.CANCELLED) {
            order.setCancelledAt(LocalDateTime.now());
        }

        appendHistory(order, "Статус изменён на «" + newStatus.getLabel() + "»");
        auditLogService.log("Order", null, orderId, actor, "STATUS_CHANGE",
                oldStatus.name(), newStatus.name(), null);

        if (order.getClient() != null && order.getClient().getUser() != null) {
            notificationService.notify(order.getClient().getUser().getId(),
                    UserRole.CLIENT.name(), orderId,
                    "Статус заявки обновлён",
                    "Заявка " + orderId + " → " + newStatus.getLabel(), "status");
        }

        Contract contract = contractRepository.findByOrderId(orderId).orElse(null);
        return OrderResponse.from(order, false, contract);
    }

    @Transactional
    public OrderResponse updateEcologyStatus(String orderId, String ecologyStatusRaw, String comment, User actor) {
        Order order = getOrThrow(orderId);
        EcologyStatus oldStatus = order.getEcologyStatus();
        EcologyStatus newStatus;
        try {
            newStatus = EcologyStatus.valueOf(ecologyStatusRaw);
        } catch (Exception ex) {
            throw new BadRequestException("Недопустимый ecologyStatus. Допустимо: not_started, in_progress, waiting_client_data, done");
        }
        order.setEcologyStatus(newStatus);

        appendHistory(order, "Экологический статус → " + newStatus.name());
        if (comment != null && !comment.isBlank()) {
            appendHistory(order, comment.trim());
        }

        auditLogService.log("Order", null, orderId, actor, "ECOLOGY_STATUS_CHANGE",
                oldStatus != null ? oldStatus.name() : null, newStatus.name(), null);
        return toStaffOrderResponse(order);
    }

    @Transactional
    public OrderResponse updateLaboratoryStatus(String orderId, String laboratoryStatusRaw, String comment, User actor) {
        Order order = getOrThrow(orderId);
        LaboratoryStatus oldStatus = order.getLaboratoryStatus();
        LaboratoryStatus newStatus;
        try {
            newStatus = LaboratoryStatus.valueOf(laboratoryStatusRaw);
        } catch (Exception ex) {
            throw new BadRequestException("Недопустимый laboratoryStatus. Допустимо: not_assigned, waiting_samples, samples_received, analysis_in_progress, result_ready");
        }
        if (newStatus == LaboratoryStatus.done) {
            throw new BadRequestException("Недопустимый laboratoryStatus. Используйте result_ready");
        }
        if (newStatus == LaboratoryStatus.result_ready) {
            // result_ready is a claim that a signed, client-published protocol backs this order up
            // - it must never be settable by hand (spec §27). It is set automatically, and only,
            // from markLaboratoryResultReadyFromProtocol() when a protocol is actually published.
            throw new BadRequestException(
                    "result_ready устанавливается автоматически после подписания и публикации протокола клиенту");
        }
        order.setLaboratoryStatus(newStatus);

        appendHistory(order, "Лабораторный статус → " + newStatus.name());
        if (comment != null && !comment.isBlank()) {
            appendHistory(order, comment.trim());
        }

        auditLogService.log("Order", null, orderId, actor, "LABORATORY_STATUS_CHANGE",
                oldStatus != null ? oldStatus.name() : null, newStatus.name(), null);
        return toStaffOrderResponse(order);
    }

    /** The only legitimate way an order's laboratoryStatus becomes result_ready (spec §27) -
     *  called by ProtocolService right after a protocol is published to the client, never exposed
     *  through the manual updateLaboratoryStatus endpoint above. */
    @Transactional
    public void markLaboratoryResultReadyFromProtocol(String orderId, Long protocolId) {
        Order order = getOrThrow(orderId);
        LaboratoryStatus oldStatus = order.getLaboratoryStatus();
        if (oldStatus == LaboratoryStatus.result_ready) {
            return;
        }
        order.setLaboratoryStatus(LaboratoryStatus.result_ready);
        appendHistory(order, "Лабораторный статус → result_ready (протокол #" + protocolId
                + " подписан и опубликован клиенту)");
        auditLogService.log("Order", null, orderId, null, "LABORATORY_STATUS_CHANGE",
                oldStatus != null ? oldStatus.name() : null, LaboratoryStatus.result_ready.name(), null);
    }

    @Transactional
    public OrderResponse assignStaff(String orderId, String role, Long userId, User actor) {
        Order order = getOrThrow(orderId);
        User staff = userRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Пользователь не найден"));

        switch (role.toLowerCase()) {
            case "manager" -> order.setManager(staff);
            case "accountant" -> order.setAccountant(staff);
            case "ecologist" -> order.setEcologist(staff);
            case "laboratory" -> order.setLaboratoryUser(staff);
            default -> throw new BadRequestException("Неизвестная роль: " + role);
        }

        appendHistory(order, "Назначен " + role + ": " + staff.getName());
        auditLogService.log("Order", null, orderId, actor, "ASSIGN_" + role.toUpperCase(),
                null, staff.getName(), null);

        Contract contract = contractRepository.findByOrderId(orderId).orElse(null);
        return OrderResponse.from(order, false, contract);
    }

    // ── Comments ──

    @Transactional
    public CommentResponse addComment(String orderId, Long quarterId, String text,
                                       CommentVisibility visibility, User actor) {
        Order order = getOrThrow(orderId);
        CommentVisibility vis = visibility != null ? visibility : CommentVisibility.client;

        if (vis == CommentVisibility.internal && !isStaff(actor)) {
            throw new BadRequestException("Внутренние комментарии может оставлять только сотрудник");
        }

        OrderQuarter oq = null;
        if (quarterId != null) {
            oq = order.getQuarters().stream()
                    .filter(q -> q.getId().equals(quarterId))
                    .findFirst()
                    .orElseThrow(() -> new NotFoundException("Квартал не найден"));
        }

        OrderComment comment = new OrderComment();
        comment.setOrder(order);
        comment.setOrderQuarter(oq);
        comment.setAuthorUser(actor);
        comment.setAuthorName(actor.getName());
        comment.setAuthorRole(actor.getRole().name());
        comment.setText(text);
        comment.setVisibility(vis);
        commentRepository.save(comment);
        order.getComments().add(0, comment);

        appendHistory(order, vis == CommentVisibility.client
                ? "Добавлен комментарий" : "Добавлен внутренний комментарий");

        String preview = text != null && text.length() > 120 ? text.substring(0, 120) + "…" : text;
        if (isStaff(actor) && vis == CommentVisibility.client) {
            mailNotificationService.onStaffCommentToClient(order, preview);
        } else if (!isStaff(actor)) {
            mailNotificationService.onClientComment(order, preview);
        }

        return CommentResponse.from(comment);
    }

    // ── Documents ──

    @Transactional
    public DocumentResponse uploadDocument(String orderId, MultipartFile file,
                                            String typeRaw, User actor) throws IOException {
        return uploadDocument(orderId, file, typeRaw, null, null, null, null, null, null, null, actor);
    }

    @Transactional
    public DocumentResponse uploadDocument(String orderId, MultipartFile file,
                                            String typeRaw,
                                            Boolean sendToClient,
                                            Boolean needsSignature,
                                            Boolean needsClientResponse,
                                            String staffComment,
                                            String dueDateRaw,
                                            String title,
                                            String name,
                                            User actor) throws IOException {
        Order order = getOrThrow(orderId);
        DocumentType type = normalizeDocumentType(typeRaw);
        DocumentVisibility vis = (type == DocumentType.internal) ? DocumentVisibility.internal
                : (type == DocumentType.result) ? DocumentVisibility.client
                : DocumentVisibility.client;

        if ((type == DocumentType.internal || type == DocumentType.result) && !isStaff(actor)) {
            throw new BadRequestException("Тип документа доступен только сотрудникам");
        }

        StoredFileMetadata stored = fileStorageService.store(file, orderId, actor.getEmail());

        OrderDocument doc = new OrderDocument();
        doc.setOrder(order);
        doc.setContractId(order.getContractId());
        doc.setUploadedByUser(actor);
        doc.setUploadedByRole(actor.getRole().name());
        doc.setName(resolveDocumentName(stored.filename(), file.getOriginalFilename(), title, name));
        doc.setFileName(file.getOriginalFilename());
        doc.setMimeType(file.getContentType());
        doc.setFileSize(file.getSize());
        doc.setType(type);
        doc.setVisibility(vis);
        doc.setStatus(type == DocumentType.result ? "Готово" : "Загружен");
        doc.setStoredPath(stored.fileId());
        doc.setFileUrl("/api/files/documents/" + stored.fileId());

        boolean send = Boolean.TRUE.equals(sendToClient);
        if (send) {
            doc.setSentToClient(true);
            doc.setNeedsSignature(Boolean.TRUE.equals(needsSignature));
            doc.setNeedsClientResponse(Boolean.TRUE.equals(needsClientResponse));
            doc.setStaffComment(staffComment);
            if (dueDateRaw != null && !dueDateRaw.isBlank()) {
                try {
                    doc.setDueDate(LocalDate.parse(dueDateRaw));
                } catch (Exception ex) {
                    throw new BadRequestException("Неверный формат dueDate. Ожидается ISO-формат yyyy-MM-dd");
                }
            }
            doc.setStatus(Boolean.TRUE.equals(needsSignature) ? "waiting_signature" : "sent_to_client");
        }

        documentRepository.save(doc);
        order.getDocuments().add(0, doc);

        appendHistory(order, send
                ? "Документ загружен и отправлен клиенту: " + doc.getName()
                : "Документ загружен: " + doc.getName());

        if (send && order.getClient() != null && order.getClient().getUser() != null) {
            notificationService.notify(order.getClient().getUser().getId(),
                    UserRole.CLIENT.name(), orderId,
                    "Документ на согласование",
                    "По заявке " + orderId + " требуется согласование: " + doc.getName(), "agreement");
        }
        if (send) {
            mailNotificationService.onDocumentSent(order, doc.getName(), doc.isNeedsSignature());
        }

        return DocumentResponse.from(doc);
    }

    private DocumentType normalizeDocumentType(String typeRaw) {
        if (typeRaw == null || typeRaw.isBlank()) {
            return DocumentType.client;
        }
        String type = typeRaw.trim().toLowerCase();
        return switch (type) {
            case "client", "project_document", "agreement" -> DocumentType.client;
            case "result", "work_result", "protocol", "report", "result_ready" -> DocumentType.result;
            case "invoice" -> DocumentType.invoice;
            case "contract" -> DocumentType.contract;
            case "act" -> DocumentType.act;
            case "internal" -> DocumentType.internal;
            default -> throw new BadRequestException(
                    "Недопустимый type: " + typeRaw
                            + ". Допустимо: client, result, invoice, contract, act, internal; "
                            + "фронтовые алиасы: work_result, project_document, protocol, report, agreement");
        };
    }

    private String resolveDocumentName(String storedFilename, String originalFilename, String title, String name) {
        if (title != null && !title.isBlank()) {
            return title.trim();
        }
        if (name != null && !name.isBlank()) {
            return name.trim();
        }
        if (storedFilename != null && !storedFilename.isBlank()) {
            return storedFilename;
        }
        if (originalFilename != null && !originalFilename.isBlank()) {
            return originalFilename;
        }
        return "document";
    }

    @Transactional
    public DocumentResponse sendDocumentToClient(String orderId, Long documentId,
                                                  SendDocumentToClientRequest request, User actor) {
        Order order = getOrThrow(orderId);
        if (!isStaff(actor)) {
            throw new UnauthorizedException("Только сотрудник может отправить документ клиенту");
        }

        OrderDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Документ не найден"));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }

        doc.setSentToClient(true);
        doc.setNeedsSignature(request.needsSignature());
        doc.setNeedsClientResponse(request.needsClientResponse());
        doc.setStaffComment(request.staffComment());
        doc.setDueDate(request.dueDate());
        doc.setVisibility(DocumentVisibility.client);
        doc.setStatus(doc.isNeedsSignature() ? "waiting_signature" : "sent_to_client");
        doc.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(doc);

        appendHistory(order, "Документ отправлен клиенту на согласование: " + doc.getName());

        if (order.getClient() != null && order.getClient().getUser() != null) {
            notificationService.notify(order.getClient().getUser().getId(),
                    UserRole.CLIENT.name(), orderId,
                    "Документ на согласование",
                    "По заявке " + orderId + " требуется согласование: " + doc.getName(), "agreement");
        }
        mailNotificationService.onDocumentSent(order, doc.getName(), doc.isNeedsSignature());

        return DocumentResponse.from(doc);
    }

    @Transactional
    public DocumentResponse respondToDocument(String orderId, Long documentId,
                                               DocumentRespondRequest request, User actor) {
        Order order = getOrThrow(orderId);
        ensureClientOwns(order, actor);

        OrderDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Документ не найден"));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }
        if (!doc.isSentToClient() && !doc.isNeedsSignature()) {
            throw new BadRequestException("Документ не ожидает ответа клиента");
        }

        String action = request.action().trim().toLowerCase();
        if ("signed".equals(action)) {
            cmsSignatureValidator.validateRequired(request.signedCms());
            if (request.signedCms() != null && !request.signedCms().isBlank()) {
                cmsSignatureValidator.validate(request.signedCms());
            }
            doc.setSignedCms(request.signedCms());
            doc.setSignerSubject(request.signerSubject());
            doc.setSignedAt(LocalDateTime.now());
            doc.setStatus("signed");
            doc.setClientResponseStatus("signed");
        } else {
            doc.setClientResponseStatus(action);
            doc.setStatus("Клиент ответил: " + action);
        }
        if (request.comment() != null) {
            doc.setClientComment(request.comment());
        }
        doc.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(doc);

        appendHistory(order, "Клиент ответил по документу «" + doc.getName() + "»: " + action);
        notificationService.notify(null, UserRole.MANAGER.name(), orderId,
                "Ответ по документу",
                "Клиент ответил по «" + doc.getName() + "»", "document_response");
        if ("signed".equals(action)) {
            mailNotificationService.onDocumentSigned(order, doc.getName());
        }

        return DocumentResponse.from(doc);
    }

    @Transactional
    public DocumentResponse respondToAgreement(String orderId, Long documentId,
                                                AgreementResponseRequest request, User actor) {
        Order order = getOrThrow(orderId);
        ensureClientOwns(order, actor);

        OrderDocument doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Документ не найден"));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }
        if (!doc.isSentToClient()) {
            throw new BadRequestException("Документ не отправлен клиенту на согласование");
        }

        String action = request.action().trim().toLowerCase();
        String responseStatus = switch (action) {
            case "accepted" -> "accepted";
            case "signed" -> "signed";
            case "sent_without_signature" -> "sent_without_signature";
            case "revision_requested" -> "revision_requested";
            default -> throw new BadRequestException(
                    "Неизвестное действие. Допустимо: accepted, signed, sent_without_signature, revision_requested");
        };

        doc.setClientResponseStatus(responseStatus);
        doc.setClientComment(request.comment());
        if ("signed".equals(responseStatus)) {
            cmsSignatureValidator.validateRequired(request.signedCms());
            if (request.signedCms() != null && !request.signedCms().isBlank()) {
                cmsSignatureValidator.validate(request.signedCms());
            }
            doc.setSignedCms(request.signedCms());
            doc.setSignerSubject(request.signerSubject());
            doc.setSignedAt(LocalDateTime.now());
            doc.setStatus("signed");
            mailNotificationService.onDocumentSigned(order, doc.getName());
        } else {
            doc.setStatus(switch (responseStatus) {
                case "accepted", "sent_without_signature" -> "Согласовано клиентом";
                case "revision_requested" -> "Требуется доработка";
                default -> doc.getStatus();
            });
        }
        doc.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(doc);

        AgreementResponse ar = new AgreementResponse();
        ar.setOrderId(orderId);
        ar.setDocumentId(documentId);
        ar.setAction(responseStatus);
        ar.setComment(request.comment());
        ar.setRespondedByUser(actor);
        agreementResponseRepository.save(ar);

        appendHistory(order, "Клиент ответил по документу «" + doc.getName() + "»: " + responseStatus);

        notificationService.notify(null, UserRole.MANAGER.name(), orderId,
                "Ответ по согласованию",
                "Клиент ответил по документу «" + doc.getName() + "» (" + responseStatus + ")", "agreement_response");

        return DocumentResponse.from(doc);
    }

    @Transactional
    public OrderResponse updateOrderPayment(String orderId, UpdateOrderPaymentRequest request, User actor) {
        if (!isStaff(actor)) {
            throw new UnauthorizedException("Только сотрудник может менять статус оплаты");
        }
        Order order = getOrThrow(orderId);
        PaymentStatus old = order.getPaymentStatus();
        order.setPaymentStatus(request.paymentStatus());
        if (request.paymentMethod() != null) {
            order.setPaymentMethod(request.paymentMethod());
        }
        appendHistory(order, "Статус оплаты: " + old + " → " + request.paymentStatus());
        auditLogService.log("Order", null, orderId, actor, "PAYMENT_STATUS",
                old.name(), request.paymentStatus().name(), null);

        Contract contract = contractRepository.findByOrderId(orderId).orElse(null);
        return OrderResponse.from(order, false, contract);
    }

    @Transactional
    public List<PrimaryDocumentResponse> batchRequestPrimaryDocuments(
            String orderId, BatchRequestPrimaryDocumentsRequest request, User actor) {
        return request.documents().stream()
                .map(req -> requestPrimaryDocument(orderId, req, actor))
                .toList();
    }

    // ── Contract flow ──

    @Transactional
    public OrderResponse signContract(String orderId, SignContractRequest request, User actor) {
        Order order = getOrThrow(orderId);
        ensureClientOwns(order, actor);

        if (order.getContractStatus() != ContractStatus.sent) {
            throw new BadRequestException("Договор ещё не отправлен сотрудником");
        }

        String signedCms = request != null ? request.signedCms() : null;
        cmsSignatureValidator.validateRequired(signedCms);
        if (signedCms != null && !signedCms.isBlank()) {
            cmsSignatureValidator.validate(signedCms);
        }

        Contract contract = contractRepository.findByOrderId(orderId)
                .orElseThrow(() -> new BadRequestException("Договор не найден по заявке"));

        String provider = request != null
                ? orBlank(request.signatureProvider(), order.getSignatureProvider())
                : order.getSignatureProvider();
        LocalDateTime signedAt = parseSignedAt(request != null ? request.signedAt() : null);
        String signerSubject = request != null ? request.signerSubject() : null;

        order.setContractStatus(ContractStatus.signed);
        order.setCrmContractStatus(CrmContractStatus.signed);
        order.setSignatureProvider(provider);
        order.setSignedAt(signedAt);

        contract.setStatus("signed");
        contract.setCrmStatus(CrmContractStatus.signed);
        contract.setSignedAt(signedAt);
        contract.setSignedCms(signedCms);
        contract.setSignerSubject(signerSubject);
        contract.setSignatureProvider(provider);
        contractRepository.save(contract);

        OrderDocument contractDoc = resolveContractDocument(order,
                request != null ? request.documentId() : null);
        if (contractDoc != null) {
            contractDoc.setStatus("signed");
            contractDoc.setClientResponseStatus("signed");
            contractDoc.setSignedCms(signedCms);
            contractDoc.setSignerSubject(signerSubject);
            contractDoc.setSignedAt(signedAt);
            contractDoc.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(contractDoc);
        }

        appendHistory(order, "Договор подписан ЭЦП"
                + (signerSubject != null ? " (" + signerSubject + ")" : "")
                + " через " + provider);

        auditLogService.log("Order", contract.getId(), orderId, actor, "CONTRACT_SIGN",
                null, provider, signerSubject);

        notifyContractSigned(order);
        mailNotificationService.onContractSigned(order);

        return OrderResponse.from(order, true, contract);
    }

    @Transactional
    public OrderResponse payOrder(String orderId, String paymentMethod, User actor) {
        Order order = getOrThrow(orderId);
        if (order.getPaymentStatus() != PaymentStatus.pending && order.getPaymentStatus() != PaymentStatus.not_sent) {
            if (order.getPaymentStatus() == PaymentStatus.paid) {
                throw new BadRequestException("Счёт уже оплачен");
            }
        }

        String method = orBlank(paymentMethod, order.getPaymentMethod());
        order.setPaymentStatus(PaymentStatus.paid);
        order.setPaymentMethod(method);

        attachDocument(order, "Квитанция об оплате " + orderId + ".pdf",
                DocumentType.invoice, DocumentVisibility.client, "Оплачено", actor);
        appendHistory(order, "Счёт оплачен онлайн: " + method);

        auditLogService.log("Order", null, orderId, actor, "PAYMENT", null, method, null);

        notificationService.notify(null, UserRole.MANAGER.name(), orderId,
                "Оплата подтверждена",
                "Заявка " + orderId + " оплачена", "payment_confirmed");
        mailNotificationService.onPaymentConfirmed(order);

        Contract contract = contractRepository.findByOrderId(orderId).orElse(null);
        return OrderResponse.from(order, true, contract);
    }

    @Transactional
    public OrderResponse sendContractAndInvoice(String orderId, SendContractRequest request, User actor) {
        Order order = getOrThrow(orderId);
        order.setContractStatus(ContractStatus.sent);
        order.setPaymentStatus(PaymentStatus.pending);
        if (request.amount() != null) order.setPaymentAmount(request.amount());
        if (request.paymentMethod() != null) order.setPaymentMethod(request.paymentMethod());
        if (request.signatureProvider() != null) order.setSignatureProvider(request.signatureProvider());

        boolean needsSignature = request.signatureProvider() != null
                || (order.getSignatureProvider() != null && order.getSignatureProvider().toLowerCase().contains("эцп"));
        order.setCrmContractStatus(needsSignature
                ? CrmContractStatus.waiting_signature
                : CrmContractStatus.sent_to_client);

        Contract contract = ensureContractForOrder(order, request, actor);
        contract.setCrmStatus(needsSignature
                ? CrmContractStatus.waiting_signature
                : CrmContractStatus.sent_to_client);
        contract.setStatus("sent");
        if (request.amount() != null) {
            contract.setTotalAmount(request.amount());
            contract.setRemainingAmount(request.amount());
        }
        contractRepository.save(contract);
        order.setContractId(contract.getId());

        String contractFile = orBlank(request.contractFileName(), "Договор " + orderId + " для подписания.pdf");
        OrderDocument contractDoc = attachDocument(order, contractFile, DocumentType.contract,
                DocumentVisibility.client, needsSignature ? "waiting_signature" : "sent_to_client", actor);
        contractDoc.setSentToClient(true);
        contractDoc.setNeedsSignature(needsSignature);
        contractDoc.setContractId(contract.getId());
        documentRepository.save(contractDoc);

        if (request.amount() != null) {
            OrderDocument invoiceDoc = attachDocument(order, "Счёт на оплату " + orderId + ".pdf",
                    DocumentType.invoice, DocumentVisibility.client, "Ожидает оплаты", actor);
            invoiceDoc.setSentToClient(true);
            invoiceDoc.setContractId(contract.getId());
            documentRepository.save(invoiceDoc);
            mailNotificationService.onPaymentInvoice(order);
        }

        appendHistory(order, "Сотрудник отправил договор и счёт" +
                (request.amount() != null ? " на " + request.amount() + " ₸" : ""));

        if (order.getClient() != null && order.getClient().getUser() != null) {
            notificationService.notify(order.getClient().getUser().getId(),
                    UserRole.CLIENT.name(), orderId,
                    "Договор и счёт",
                    "По заявке " + orderId + " отправлены договор и счёт", "contract");
        }
        mailNotificationService.onContractSent(order);

        return OrderResponse.from(order, false, contract);
    }

    @Transactional
    public OrderResponse updateContractStatus(String orderId, CrmContractStatus crmStatus, User actor) {
        Order order = getOrThrow(orderId);
        CrmContractStatus old = order.getCrmContractStatus();
        order.setCrmContractStatus(crmStatus);

        Contract contract = contractRepository.findByOrderId(orderId).orElse(null);
        if (contract != null) {
            contract.setCrmStatus(crmStatus);
            contractRepository.save(contract);
        }

        appendHistory(order, "CRM-статус договора → " + crmStatus.name());
        auditLogService.log("Order", null, orderId, actor, "CRM_CONTRACT_STATUS",
                old != null ? old.name() : null, crmStatus.name(), null);

        return OrderResponse.from(order, false, contract);
    }

    // ── Quarter operations ──

    @Transactional
    public QuarterResponse updateQuarterWorkStatus(String orderId, Long quarterId,
                                                    WorkStatus workStatus, String comment, User actor) {
        Order order = getOrThrow(orderId);
        OrderQuarter oq = findQuarter(order, quarterId);
        WorkStatus old = oq.getWorkStatus();
        oq.setWorkStatus(workStatus);

        if (workStatus == WorkStatus.in_progress && oq.getStartedAt() == null) {
            oq.setStartedAt(LocalDateTime.now());
        }
        if (workStatus == WorkStatus.completed) {
            oq.setCompletedAt(LocalDateTime.now());
        }

        quarterRepository.save(oq);

        ContractQuarter cq = contractQuarterRepository.findByContractIdAndQuarter(
                oq.getContractId(), oq.getQuarter()).orElse(null);
        if (cq != null) {
            cq.setWorkStatus(workStatus);
            if (comment != null) cq.setComment(comment);
            if (workStatus == WorkStatus.completed) cq.setCompletedAt(LocalDateTime.now());
            contractQuarterRepository.save(cq);
        }

        appendHistory(order, "Квартал " + oq.getQuarterLabel() + " → " + workStatus.name());
        auditLogService.log("OrderQuarter", oq.getId(), orderId, actor,
                "QUARTER_WORK_STATUS", old.name(), workStatus.name(), comment);

        return QuarterResponse.from(oq, false, order.getComments());
    }

    @Transactional
    public QuarterDocumentResponse uploadQuarterDocument(String orderId, Long quarterId,
                                                          MultipartFile file, String typeRaw, User actor) throws IOException {
        Order order = getOrThrow(orderId);
        OrderQuarter oq = findQuarter(order, quarterId);

        QuarterDocumentType docType = typeRaw != null ? QuarterDocumentType.valueOf(typeRaw) : QuarterDocumentType.other;
        DocumentVisibility vis = isStaff(actor) ? DocumentVisibility.client : DocumentVisibility.client;

        StoredFileMetadata stored = fileStorageService.store(file, orderId, actor.getEmail());

        QuarterDocument doc = new QuarterDocument();
        doc.setOrder(order);
        doc.setOrderQuarter(oq);
        doc.setContractId(oq.getContractId());
        doc.setUploadedByUser(actor);
        doc.setUploadedByRole(actor.getRole().name());
        doc.setUploadedByName(actor.getName());
        doc.setName(file.getOriginalFilename());
        doc.setFileName(file.getOriginalFilename());
        doc.setFileUrl("/api/files/documents/" + stored.fileId());
        doc.setMimeType(file.getContentType());
        doc.setFileSize(file.getSize());
        doc.setDocumentType(docType);
        doc.setVisibility(vis);
        oq.getQuarterDocuments().add(0, doc);

        appendHistory(order, "Документ загружен для " + oq.getQuarterLabel() + ": " + file.getOriginalFilename());
        return QuarterDocumentResponse.from(doc);
    }

    @Transactional
    public QuarterResultResponse addQuarterResult(String orderId, Long quarterId,
                                                    String title, String description, String resultType, User actor) {
        Order order = getOrThrow(orderId);
        OrderQuarter oq = findQuarter(order, quarterId);

        QuarterResult result = new QuarterResult();
        result.setOrder(order);
        result.setOrderQuarter(oq);
        result.setContractId(oq.getContractId());
        result.setTitle(title);
        result.setDescription(description);
        result.setResultType(resultType);
        result.setCreatedByUser(actor);
        result.setCreatedByName(actor.getName());
        oq.getQuarterResults().add(0, result);

        appendHistory(order, "Результат добавлен для " + oq.getQuarterLabel() + ": " + title);

        return QuarterResultResponse.from(result);
    }

    @Transactional
    public CommentResponse addQuarterComment(String orderId, Long quarterId, String text,
                                              CommentVisibility visibility, User actor) {
        return addComment(orderId, quarterId, text, visibility, actor);
    }

    @Transactional
    public void addQuarterPayment(String orderId, Long quarterId,
                                   BigDecimal amount, String method, String comment, User actor) {
        Order order = getOrThrow(orderId);
        OrderQuarter oq = findQuarter(order, quarterId);
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("Сумма должна быть больше нуля");
        }

        ContractQuarter cq = null;
        if (oq.getContractId() != null) {
            cq = contractQuarterRepository.findByContractIdAndQuarter(oq.getContractId(), oq.getQuarter()).orElse(null);
        }

        PaymentTransaction tx = new PaymentTransaction();
        tx.setContractId(oq.getContractId());
        tx.setContractQuarterId(cq != null ? cq.getId() : null);
        tx.setOrderQuarterId(oq.getId());
        tx.setAmount(amount);
        tx.setMethod(orBlank(method, "Банковский перевод"));
        tx.setPaidAt(LocalDate.now());
        tx.setComment(comment);
        tx.setCreatedByUser(actor);
        tx.setCreatedByName(actor.getName());
        paymentTransactionRepository.save(tx);

        if (cq != null) {
            cq.setPaidAmount(cq.getPaidAmount().add(amount));
            cq.setRemainingAmount(cq.getPlannedAmount().subtract(cq.getPaidAmount()).max(BigDecimal.ZERO));
            cq.setLastPaymentDate(LocalDate.now());
            cq.recalcPaymentStatus();
            contractQuarterRepository.save(cq);
        }

        oq.setPaidAmount(oq.getPaidAmount().add(amount));
        oq.setRemainingAmount(oq.getPlannedAmount().subtract(oq.getPaidAmount()).max(BigDecimal.ZERO));
        oq.setLastPaymentDate(LocalDate.now());
        oq.recalcPaymentStatus();
        quarterRepository.save(oq);

        Contract contract = oq.getContractId() != null
                ? contractRepository.findById(oq.getContractId()).orElse(null)
                : null;
        if (contract != null) {
            contract.recalcTotals();
            contractRepository.save(contract);
        }

        handleDebt(oq, cq, order);

        appendHistory(order, "Оплата " + amount + " ₸ за " + oq.getQuarterLabel());
        auditLogService.log("OrderQuarter", oq.getId(), orderId, actor,
                "QUARTER_PAYMENT", null, amount.toPlainString(), comment);
    }

    @Transactional
    public OrderResponse completeAnnual(String orderId, User actor) {
        Order order = getOrThrow(orderId);
        if (order.getContractType() != ContractType.annual_quarterly) {
            throw new BadRequestException("Заявка не является годовой");
        }

        for (OrderQuarter oq : order.getQuarters()) {
            if (oq.getWorkStatus() != WorkStatus.completed) {
                throw new BadRequestException("Не все кварталы завершены (квартал " + oq.getQuarterLabel() + ")");
            }
            if (oq.getQuarterResults().isEmpty()) {
                throw new BadRequestException("Нет результатов для квартала " + oq.getQuarterLabel());
            }
        }

        List<Debt> activeDebts = debtRepository.findByOrderIdOrderByCreatedAtDesc(orderId).stream()
                .filter(d -> d.getStatus() != DebtStatus.closed)
                .toList();
        if (!activeDebts.isEmpty()) {
            throw new BadRequestException("Есть неоплаченные задолженности (" + activeDebts.size() + ")");
        }

        order.setStatus(OrderStatus.COMPLETED);
        order.setCompletedAt(LocalDateTime.now());

        Contract contract = contractRepository.findByOrderId(orderId).orElse(null);
        if (contract != null) {
            contract.setStatus("completed");
            contractRepository.save(contract);
        }

        appendHistory(order, "Годовое обслуживание завершено");
        auditLogService.log("Order", null, orderId, actor, "ANNUAL_COMPLETE", null, null, null);

        return OrderResponse.from(order, false, contract);
    }

    // ── Helpers: annual creation ──

    private void createAnnualStructure(Order order, Client client, User actor) {
        int year = LocalDate.now().getYear();

        String shortCompany = client.getCompanyName() != null
                ? client.getCompanyName().substring(0, Math.min(client.getCompanyName().length(), 10)).toUpperCase().replaceAll("\\s+", "")
                : "CLT";
        String contractNumber = "EPG-" + shortCompany + "-" + year + "-Q";
        if (contractRepository.existsByContractNumber(contractNumber)) {
            contractNumber = contractNumber + "-" + ThreadLocalRandom.current().nextInt(100, 999);
        }

        Contract contract = new Contract();
        contract.setOrderId(order.getId());
        contract.setClient(client);
        contract.setBusinessCompanyId(order.getBusinessCompanyId());
        contract.setContractNumber(contractNumber);
        contract.setContractType("annual_quarterly");
        contract.setStatus("draft");
        contract.setCrmStatus(CrmContractStatus.not_created);
        contract.setStartsAt(LocalDate.of(year, 1, 1));
        contract.setEndsAt(LocalDate.of(year, 12, 31));
        if (order.getManager() != null) contract.setResponsibleManager(order.getManager());
        contractRepository.save(contract);

        order.setContractId(contract.getId());
        order.setAnnualPeriodStart(contract.getStartsAt());
        order.setAnnualPeriodEnd(contract.getEndsAt());
        order.setStatus(OrderStatus.ANNUAL_ACTIVE);

        String[] labels = {"Q1", "Q2", "Q3", "Q4"};
        LocalDate[] starts = {
                LocalDate.of(year, 1, 1), LocalDate.of(year, 4, 1),
                LocalDate.of(year, 7, 1), LocalDate.of(year, 10, 1)
        };
        LocalDate[] ends = {
                LocalDate.of(year, 3, 31), LocalDate.of(year, 6, 30),
                LocalDate.of(year, 9, 30), LocalDate.of(year, 12, 31)
        };

        for (int i = 0; i < 4; i++) {
            ContractQuarter cq = new ContractQuarter();
            cq.setContract(contract);
            cq.setOrderId(order.getId());
            cq.setQuarter(i + 1);
            cq.setQuarterLabel(labels[i]);
            cq.setPeriodStart(starts[i]);
            cq.setPeriodEnd(ends[i]);
            cq.setServiceName(order.getServiceName());
            cq.setWorkStage("Этап " + (i + 1));
            contract.getQuarters().add(cq);

            OrderQuarter oq = new OrderQuarter();
            oq.setOrder(order);
            oq.setContractId(contract.getId());
            oq.setQuarter(i + 1);
            oq.setQuarterLabel(labels[i]);
            oq.setPeriodStart(starts[i]);
            oq.setPeriodEnd(ends[i]);
            oq.setServiceName(order.getServiceName());
            oq.setWorkStage("Этап " + (i + 1));
            order.getQuarters().add(oq);
        }

        contractRepository.save(contract);
        orderRepository.save(order);

        auditLogService.log("Contract", contract.getId(), order.getId(), actor,
                "CONTRACT_CREATED", null, contractNumber, null);
    }

    private void handleDebt(OrderQuarter oq, ContractQuarter cq, Order order) {
        if (oq.getDueDate() == null) return;
        if (oq.getRemainingAmount().compareTo(BigDecimal.ZERO) <= 0) {
            debtRepository.findByContractIdAndContractQuarterIdAndStatusNot(
                    oq.getContractId(), cq != null ? cq.getId() : null, DebtStatus.closed
            ).ifPresent(debt -> {
                debt.setPaidAmount(oq.getPaidAmount());
                debt.setRemainingAmount(BigDecimal.ZERO);
                debt.setStatus(DebtStatus.closed);
                debt.setClosedAt(LocalDateTime.now());
                debtRepository.save(debt);
            });
            return;
        }

        if (LocalDate.now().isAfter(oq.getDueDate())) {
            Optional<Debt> existing = debtRepository.findByContractIdAndContractQuarterIdAndStatusNot(
                    oq.getContractId(), cq != null ? cq.getId() : null, DebtStatus.closed);
            if (existing.isPresent()) {
                Debt debt = existing.get();
                debt.setPaidAmount(oq.getPaidAmount());
                debt.setRemainingAmount(oq.getRemainingAmount());
                debt.setStatus(oq.getRemainingAmount().compareTo(BigDecimal.ZERO) > 0
                        ? DebtStatus.partial : DebtStatus.closed);
                debtRepository.save(debt);
            } else {
                Debt debt = new Debt();
                debt.setOrderId(order.getId());
                debt.setContractId(oq.getContractId());
                debt.setContractQuarterId(cq != null ? cq.getId() : null);
                debt.setOrderQuarterId(oq.getId());
                debt.setInvoiceNumber(oq.getInvoiceNumber());
                debt.setQuarterLabel(oq.getQuarterLabel());
                debt.setAmount(oq.getPlannedAmount());
                debt.setPaidAmount(oq.getPaidAmount());
                debt.setRemainingAmount(oq.getRemainingAmount());
                debt.setStatus(DebtStatus.active);
                debt.setReason("Просрочка по кварталу " + oq.getQuarterLabel());
                debt.setDueDate(oq.getDueDate());
                if (order.getClient() != null) {
                    debt.setClientEmail(order.getClient().getEmail());
                }
                debtRepository.save(debt);
            }
        }
    }

    // ── Internal helpers ──

    private OrderDocument attachDocument(Order order, String name, DocumentType type,
                                          DocumentVisibility visibility, String status, User actor) {
        OrderDocument doc = new OrderDocument();
        doc.setOrder(order);
        doc.setContractId(order.getContractId());
        if (actor != null) {
            doc.setUploadedByUser(actor);
            doc.setUploadedByRole(actor.getRole().name());
        }
        doc.setName(name);
        doc.setType(type);
        doc.setVisibility(visibility);
        doc.setStatus(status);
        documentRepository.save(doc);
        order.getDocuments().add(0, doc);
        return doc;
    }

    private void validateStatusTransition(Order order, OrderStatus newStatus) {
        if (newStatus == OrderStatus.COMPLETED) {
            if (order.getPaymentStatus() != PaymentStatus.paid) {
                throw new BadRequestException("Нельзя завершить заявку без оплаты");
            }
            boolean hasPendingAgreement = order.getDocuments().stream()
                    .anyMatch(d -> d.isSentToClient()
                            && (d.isNeedsClientResponse() || d.isNeedsSignature())
                            && !"accepted".equals(d.getClientResponseStatus())
                            && !"signed".equals(d.getClientResponseStatus())
                            && !"sent_without_signature".equals(d.getClientResponseStatus()));
            if (hasPendingAgreement) {
                throw new BadRequestException("Есть документы на согласовании без ответа клиента");
            }
            List<Protocol> linkedProtocols = protocolRepository.findByOrderId(order.getId());
            boolean isLabOrder = !linkedProtocols.isEmpty()
                    || (order.getLaboratoryStatus() != null && order.getLaboratoryStatus() != LaboratoryStatus.not_assigned);
            if (isLabOrder) {
                // A protocol-linked order can no longer be completed by uploading any arbitrary
                // "result"-type document (spec §28) - it needs an actual signed, published,
                // not-superseded protocol backing it.
                validateLaboratoryCompletionOrThrow(order, linkedProtocols);
            } else {
                boolean hasResult = order.getDocuments().stream()
                        .anyMatch(d -> d.getType() == DocumentType.result);
                if (!hasResult && order.getContractType() != ContractType.annual_quarterly) {
                    throw new BadRequestException("Нельзя завершить заявку без результата");
                }
            }
        }
        if (newStatus == OrderStatus.READY) {
            long pendingPrimary = primaryDocumentRepository
                    .findByOrderIdAndDocumentGroup(order.getId(), "order").stream()
                    .filter(d -> d.getStatus() != PrimaryDocumentStatus.approved
                            && d.getStatus() != PrimaryDocumentStatus.rejected)
                    .count();
            if (pendingPrimary > 0) {
                throw new BadRequestException("Не все первичные документы проверены");
            }
            List<Protocol> linkedProtocols = protocolRepository.findByOrderId(order.getId());
            boolean isLabOrder = !linkedProtocols.isEmpty()
                    || (order.getLaboratoryStatus() != null && order.getLaboratoryStatus() != LaboratoryStatus.not_assigned);
            if (isLabOrder) {
                validateLaboratoryCompletionOrThrow(order, linkedProtocols);
            }
        }
    }

    /**
     * The full lab-completion gate (spec §28): the order's most recent non-cancelled/non-archived
     * protocol must be SIGNED, have a final PDF, be published to the client, not already be
     * superseded by a newer correction, and the order's own laboratoryStatus must already reflect
     * result_ready (which itself can only have been set by markLaboratoryResultReadyFromProtocol
     * above - see updateLaboratoryStatus's rejection of a manual result_ready). No document upload
     * of any type substitutes for this.
     */
    private void validateLaboratoryCompletionOrThrow(Order order, List<Protocol> linkedProtocols) {
        Protocol current = linkedProtocols.stream()
                .filter(p -> p.getStatus() != ProtocolStatus.REPLACED
                        && p.getStatus() != ProtocolStatus.ARCHIVED
                        && p.getStatus() != ProtocolStatus.CANCELLED)
                .max(java.util.Comparator.comparing(Protocol::getCreatedAt))
                .orElse(null);
        if (current == null) {
            throw new BadRequestException("Нельзя завершить лабораторную заявку: нет актуального протокола");
        }
        if (current.getStatus() != ProtocolStatus.SIGNED) {
            throw new BadRequestException("Нельзя завершить лабораторную заявку: протокол не подписан");
        }
        if (current.getPdfFileId() == null || current.getPdfSha256() == null) {
            throw new BadRequestException("Нельзя завершить лабораторную заявку: отсутствует финальный PDF протокола");
        }
        if (current.getPublishedAt() == null) {
            throw new BadRequestException("Нельзя завершить лабораторную заявку: протокол не опубликован клиенту");
        }
        if (current.getReplacedByProtocolId() != null) {
            throw new BadRequestException("Нельзя завершить лабораторную заявку: существует более новая версия протокола");
        }
        if (order.getLaboratoryStatus() != LaboratoryStatus.result_ready) {
            throw new BadRequestException("Нельзя завершить лабораторную заявку: лабораторный статус не result_ready");
        }
    }

    private void appendHistory(Order order, String text) {
        OrderHistory h = new OrderHistory();
        h.setOrder(order);
        h.setText(text);
        historyRepository.save(h);
        order.getHistory().add(0, h);
    }

    private OrderResponse toStaffOrderResponse(Order order) {
        List<OrderPrimaryDocument> primaryDocs =
                primaryDocumentRepository.findByOrderIdAndDocumentGroup(order.getId(), "order");
        Contract contract = contractRepository.findByOrderId(order.getId()).orElse(null);
        return OrderResponse.from(order, false, contract, primaryDocs);
    }

    private Order getOrThrow(String id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Заявка не найдена: " + id));
    }

    private OrderQuarter findQuarter(Order order, Long quarterId) {
        return order.getQuarters().stream()
                .filter(q -> q.getId().equals(quarterId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Квартал не найден"));
    }

    private Client requireClient(User user) {
        return clientRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    if (isStaff(user)) {
                        Client c = new Client();
                        c.setUser(user);
                        c.setEmail(user.getEmail());
                        c.setContactPerson(user.getName());
                        c.setPhone(user.getPhone());
                        c.setCompanyName(user.getCompanyName());
                        c.setClientType(user.getType() != null ? user.getType() : kz.eco.user.ClientType.company);
                        return clientRepository.save(c);
                    }
                    throw new BadRequestException("Профиль клиента не найден. Обратитесь в поддержку.");
                });
    }

    private void ensureClientOwns(Order order, User user) {
        Client client = clientRepository.findByUserId(user.getId()).orElse(null);
        if (client == null || order.getClient() == null || !order.getClient().getId().equals(client.getId())) {
            throw new UnauthorizedException("Заявка принадлежит другому клиенту");
        }
    }

    public boolean isStaff(User user) {
        return user != null && user.getRole().isStaffAccount();
    }

    /** Same access rule as {@link #getOrderById}: staff can see any order, a client account only
     *  the order(s) belonging to their own Client record. Exposed publicly so other controllers
     *  (e.g. FileController, when resolving who owns a downloaded file) can reuse the exact same
     *  authorization check instead of re-implementing it. Throws UnauthorizedException if denied. */
    @Transactional(readOnly = true)
    public void assertCanAccessOrder(String orderId, User user) {
        Order order = getOrThrow(orderId);
        if (!isStaff(user)) {
            ensureClientOwns(order, user);
        }
    }

    private String generateOrderId() {
        for (int attempt = 0; attempt < 10; attempt++) {
            String candidate = "ORD-" + (1000 + ThreadLocalRandom.current().nextInt(9000));
            if (!orderRepository.existsById(candidate)) return candidate;
        }
        return "ORD-" + System.currentTimeMillis();
    }

    private String orBlank(String value, String fallback) {
        return value != null && !value.isBlank() ? value : fallback;
    }

    private LocalDateTime parseSignedAt(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            return LocalDateTime.parse(raw);
        } catch (DateTimeParseException e) {
            try {
                return java.time.OffsetDateTime.parse(raw).toLocalDateTime();
            } catch (DateTimeParseException ignored) {
                return LocalDateTime.now();
            }
        }
    }

    private OrderDocument resolveContractDocument(Order order, Long documentId) {
        if (documentId != null) {
            return order.getDocuments().stream()
                    .filter(d -> Objects.equals(d.getId(), documentId))
                    .findFirst()
                    .orElseGet(() -> documentRepository.findById(documentId)
                            .filter(d -> d.getOrder().getId().equals(order.getId()))
                            .orElse(null));
        }
        return order.getDocuments().stream()
                .filter(d -> d.getType() == DocumentType.contract)
                .filter(d -> !"signed".equalsIgnoreCase(d.getStatus()))
                .findFirst()
                .orElse(null);
    }

    private Contract ensureContractForOrder(Order order, SendContractRequest request, User actor) {
        Contract contract = contractRepository.findByOrderId(order.getId()).orElse(null);
        if (contract == null) {
            contract = new Contract();
            contract.setOrderId(order.getId());
            contract.setClient(order.getClient());
            contract.setBusinessCompanyId(order.getBusinessCompanyId());
            contract.setContractNumber("EPG-" + order.getId());
            contract.setContractType(order.getContractType() != null
                    ? order.getContractType().name() : ContractType.one_time.name());
            contract.setStatus("draft");
            contract.setCrmStatus(CrmContractStatus.not_created);
            if (order.getManager() != null) {
                contract.setResponsibleManager(order.getManager());
            }
        }
        if (request.signatureProvider() != null) {
            contract.setSignatureProvider(request.signatureProvider());
        }
        contract.setResponsibleManager(orDefaultManager(contract, order));
        return contract;
    }

    private User orDefaultManager(Contract contract, Order order) {
        if (contract.getResponsibleManager() != null) return contract.getResponsibleManager();
        return order.getManager();
    }

    private void notifyContractSigned(Order order) {
        if (order.getManager() != null) {
            notificationService.notify(order.getManager().getId(),
                    UserRole.MANAGER.name(), order.getId(),
                    "Договор подписан",
                    "Клиент подписал договор по заявке " + order.getId(), "contract_signed");
        }
        if (order.getAccountant() != null) {
            notificationService.notify(order.getAccountant().getId(),
                    UserRole.ACCOUNTANT.name(), order.getId(),
                    "Договор подписан",
                    "Клиент подписал договор по заявке " + order.getId(), "contract_signed");
        }
        if (order.getManager() == null && order.getAccountant() == null) {
            notificationService.notify(null, UserRole.MANAGER.name(), order.getId(),
                    "Договор подписан",
                    "Клиент подписал договор по заявке " + order.getId(), "contract_signed");
        }
    }

    // ── Primary documents (order group) ──

    @Transactional
    public PrimaryDocumentResponse requestPrimaryDocument(String orderId,
                                                           RequestPrimaryDocumentRequest req, User user) {
        Order order = getOrThrow(orderId);

        OrderPrimaryDocument doc = new OrderPrimaryDocument();
        doc.setOrder(order);
        doc.setDocumentGroup("order");
        doc.setName(req.name());
        doc.setRequired(req.required());
        doc.setStatus(PrimaryDocumentStatus.need_upload);
        doc.setStaffComment(req.comment());
        doc.setRequestedAt(LocalDateTime.now());
        primaryDocumentRepository.save(doc);

        appendHistory(order, "Запрошен первичный документ: " + req.name());

        if (order.getClient() != null && order.getClient().getUser() != null) {
            notificationService.notify(order.getClient().getUser().getId(),
                    UserRole.CLIENT.name(), orderId,
                    "Запрос документов",
                    "По заявке " + orderId + " запрошен документ: " + req.name(), "doc_request");
        }
        mailNotificationService.onPrimaryDocsRequested(order, req.name());

        return PrimaryDocumentResponse.from(doc);
    }

    @Transactional
    public PrimaryDocumentResponse updatePrimaryDocumentStatus(String orderId, Long docId,
                                                                UpdatePrimaryDocumentStatusRequest req, User user) {
        Order order = getOrThrow(orderId);
        OrderPrimaryDocument doc = primaryDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Документ не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }

        PrimaryDocumentStatus newStatus = PrimaryDocumentStatus.fromValue(req.status());
        doc.setStatus(newStatus);
        String staffComment = req.resolvedComment();
        if (staffComment != null) doc.setStaffComment(staffComment);
        if (newStatus == PrimaryDocumentStatus.approved) doc.setReviewedAt(LocalDateTime.now());
        if (newStatus == PrimaryDocumentStatus.rejected) doc.setRejectedAt(LocalDateTime.now());
        if (newStatus == PrimaryDocumentStatus.needs_fix) doc.setFixRequestedAt(LocalDateTime.now());
        primaryDocumentRepository.save(doc);

        appendHistory(order, "Статус документа «" + doc.getName() + "» → " + newStatus.getValue());

        if (order.getClient() != null && order.getClient().getUser() != null) {
            if (newStatus == PrimaryDocumentStatus.approved) {
                notificationService.notify(order.getClient().getUser().getId(),
                        UserRole.CLIENT.name(), orderId,
                        "Документ принят",
                        "Документ «" + doc.getName() + "» по заявке " + orderId + " принят", "doc_approved");
            } else if (newStatus == PrimaryDocumentStatus.needs_fix || newStatus == PrimaryDocumentStatus.rejected) {
                notificationService.notify(order.getClient().getUser().getId(),
                        UserRole.CLIENT.name(), orderId,
                        "Документ требует исправления",
                        "Документ «" + doc.getName() + "» по заявке " + orderId + " нужно исправить", "doc_rejected");
            }
        }

        return PrimaryDocumentResponse.from(doc);
    }

    @Transactional
    public PrimaryDocumentResponse uploadPrimaryDocument(String orderId, Long docId,
                                                          UploadPrimaryDocumentRequest req, User user) {
        Order order = getOrThrow(orderId);
        OrderPrimaryDocument doc = primaryDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Документ не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }

        doc.setFileName(req.fileName());
        doc.setClientComment(req.clientComment());
        doc.setStatus(PrimaryDocumentStatus.uploaded);
        doc.setUploadedAt(LocalDateTime.now());
        primaryDocumentRepository.save(doc);

        appendHistory(order, "Клиент загрузил документ: " + doc.getName());

        notificationService.notify(null, UserRole.MANAGER.name(), orderId,
                "Документ загружен",
                "Клиент загрузил документ «" + doc.getName() + "» по заявке " + orderId, "doc_uploaded");

        return PrimaryDocumentResponse.from(doc);
    }

    @Transactional
    public PrimaryDocumentResponse uploadPrimaryDocumentFile(String orderId, Long docId,
                                                              MultipartFile file, String comment,
                                                              User user) throws IOException {
        Order order = getOrThrow(orderId);
        OrderPrimaryDocument doc = primaryDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Документ не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }

        StoredFileMetadata stored = fileStorageService.store(file, orderId, user.getEmail());

        doc.setFileName(file.getOriginalFilename());
        doc.setFileUrl("/api/files/documents/" + stored.fileId());
        doc.setStoredPath(stored.fileId());
        doc.setClientComment(comment);
        doc.setStatus(PrimaryDocumentStatus.uploaded);
        doc.setUploadedAt(LocalDateTime.now());
        primaryDocumentRepository.save(doc);

        appendHistory(order, "Клиент загрузил документ: " + doc.getName());

        notificationService.notify(null, UserRole.MANAGER.name(), orderId,
                "Документ загружен",
                "Клиент загрузил документ «" + doc.getName() + "» по заявке " + orderId, "doc_uploaded");

        return PrimaryDocumentResponse.from(doc);
    }

    @Transactional
    public void deletePrimaryDocument(String orderId, Long docId, User user) {
        Order order = getOrThrow(orderId);
        OrderPrimaryDocument doc = primaryDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Документ не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }
        if (doc.getStatus() != PrimaryDocumentStatus.need_upload) {
            throw new BadRequestException("Нельзя удалить документ — клиент уже загрузил файл");
        }

        if (doc.getStoredPath() != null) {
            fileStorageService.delete(doc.getStoredPath());
        }
        primaryDocumentRepository.delete(doc);

        appendHistory(order, "Удалён запрос на документ: " + doc.getName());
    }

    @Transactional
    public void deletePrimaryDocumentFile(String orderId, Long docId, User user) {
        Order order = getOrThrow(orderId);
        OrderPrimaryDocument doc = primaryDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Документ не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }

        doc.setFileName(null);
        doc.setFileUrl(null);
        doc.setStoredPath(null);
        doc.setClientComment(null);
        doc.setStatus(PrimaryDocumentStatus.need_upload);
        doc.setUploadedAt(null);
        primaryDocumentRepository.save(doc);

        appendHistory(order, "Клиент удалил файл документа: " + doc.getName());
    }

    @Transactional
    public void sendPrimaryDocumentsForReview(String orderId, String clientComment, User user) {
        Order order = getOrThrow(orderId);
        List<OrderPrimaryDocument> docs = primaryDocumentRepository
                .findByOrderIdAndDocumentGroup(orderId, "order");

        for (OrderPrimaryDocument doc : docs) {
            if (doc.getStatus() == PrimaryDocumentStatus.uploaded
                    || doc.getStatus() == PrimaryDocumentStatus.needs_fix) {
                doc.setStatus(PrimaryDocumentStatus.in_review);
            }
        }
        primaryDocumentRepository.saveAll(docs);

        appendHistory(order, "Клиент отправил первичные документы на проверку"
                + (clientComment != null ? ": " + clientComment : ""));
        mailNotificationService.onPrimaryDocsReview(order);
    }

    @Transactional
    public void sendPrimaryDocumentForReview(String orderId, Long docId, String clientComment, User user) {
        Order order = getOrThrow(orderId);
        OrderPrimaryDocument doc = primaryDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Документ не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }
        if (doc.getFileName() == null || doc.getFileName().isBlank()) {
            throw new BadRequestException("Сначала загрузите файл");
        }
        if (doc.getStatus() != PrimaryDocumentStatus.uploaded
                && doc.getStatus() != PrimaryDocumentStatus.needs_fix) {
            throw new BadRequestException("Документ нельзя отправить на проверку в текущем статусе");
        }
        doc.setStatus(PrimaryDocumentStatus.in_review);
        if (clientComment != null && !clientComment.isBlank()) {
            doc.setClientComment(clientComment);
        }
        primaryDocumentRepository.save(doc);
        appendHistory(order, "Клиент отправил на проверку документ: " + doc.getName());
    }

    // ── Laboratory primary documents ──

    @Transactional
    public PrimaryDocumentResponse requestLaboratoryPrimaryDocument(String orderId,
                                                                     RequestPrimaryDocumentRequest req, User user) {
        Order order = getOrThrow(orderId);

        OrderPrimaryDocument doc = new OrderPrimaryDocument();
        doc.setOrder(order);
        doc.setDocumentGroup("laboratory");
        doc.setName(req.name());
        doc.setRequired(req.required());
        doc.setStatus(PrimaryDocumentStatus.need_upload);
        doc.setStaffComment(req.comment());
        doc.setRequestedAt(LocalDateTime.now());
        primaryDocumentRepository.save(doc);

        appendHistory(order, "Запрошен лабораторный документ: " + req.name());
        return PrimaryDocumentResponse.from(doc);
    }

    @Transactional
    public PrimaryDocumentResponse updateLaboratoryPrimaryDocumentStatus(String orderId, Long docId,
                                                                          UpdatePrimaryDocumentStatusRequest req, User user) {
        Order order = getOrThrow(orderId);
        OrderPrimaryDocument doc = primaryDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Документ не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }

        PrimaryDocumentStatus newStatus = PrimaryDocumentStatus.fromValue(req.status());
        doc.setStatus(newStatus);
        if (req.comment() != null) doc.setStaffComment(req.comment());
        if (newStatus == PrimaryDocumentStatus.approved) doc.setReviewedAt(LocalDateTime.now());
        if (newStatus == PrimaryDocumentStatus.rejected) doc.setRejectedAt(LocalDateTime.now());
        primaryDocumentRepository.save(doc);

        appendHistory(order, "Статус лаб. документа «" + doc.getName() + "» → " + newStatus.getValue());
        return PrimaryDocumentResponse.from(doc);
    }

    @Transactional
    public PrimaryDocumentResponse uploadLaboratoryPrimaryDocument(String orderId, Long docId,
                                                                     UploadPrimaryDocumentRequest req, User user) {
        Order order = getOrThrow(orderId);
        OrderPrimaryDocument doc = primaryDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Документ не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Документ не принадлежит заявке");
        }

        doc.setFileName(req.fileName());
        doc.setClientComment(req.clientComment());
        doc.setStatus(PrimaryDocumentStatus.uploaded);
        doc.setUploadedAt(LocalDateTime.now());
        primaryDocumentRepository.save(doc);

        appendHistory(order, "Клиент загрузил лаб. документ: " + doc.getName());
        return PrimaryDocumentResponse.from(doc);
    }

    // ── Measurement agreement ──

    @Transactional
    public MeasurementAgreementResponse saveMeasurementAgreement(String orderId,
                                                                   SaveMeasurementAgreementRequest req, User user) {
        Order order = getOrThrow(orderId);

        LaboratoryMeasurementAgreement agreement = measurementAgreementRepository
                .findByOrderId(orderId)
                .orElseGet(() -> {
                    LaboratoryMeasurementAgreement a = new LaboratoryMeasurementAgreement();
                    a.setOrder(order);
                    return a;
                });

        agreement.setStatus(MeasurementAgreementStatus.draft);
        if (req.date() != null) agreement.setDate(req.date());
        if (req.time() != null) agreement.setTime(req.time());
        if (req.address() != null) agreement.setAddress(req.address());
        if (req.company() != null) agreement.setCompany(req.company());
        if (req.contact() != null) agreement.setContact(req.contact());
        if (req.scope() != null) agreement.setScope(req.scope());
        measurementAgreementRepository.save(agreement);

        appendHistory(order, "Согласование замеров сохранено (черновик)");
        return MeasurementAgreementResponse.from(agreement);
    }

    @Transactional
    public MeasurementAgreementResponse sendMeasurementAgreement(String orderId, User user) {
        Order order = getOrThrow(orderId);
        LaboratoryMeasurementAgreement agreement = measurementAgreementRepository
                .findByOrderId(orderId)
                .orElseThrow(() -> new NotFoundException("Согласование замеров не найдено"));

        agreement.setStatus(MeasurementAgreementStatus.sent);
        agreement.setSentAt(LocalDateTime.now());
        measurementAgreementRepository.save(agreement);

        appendHistory(order, "Согласование замеров отправлено клиенту");

        if (order.getClient() != null && order.getClient().getUser() != null) {
            notificationService.notify(order.getClient().getUser().getId(),
                    UserRole.CLIENT.name(), orderId,
                    "Документ на согласование",
                    "По заявке " + orderId + " отправлен документ на согласование", "doc_approval");
        }

        return MeasurementAgreementResponse.from(agreement);
    }

    @Transactional
    public MeasurementAgreementResponse updateMeasurementAgreementStatus(String orderId,
                                                                           UpdateMeasurementStatusRequest req, User user) {
        Order order = getOrThrow(orderId);
        LaboratoryMeasurementAgreement agreement = measurementAgreementRepository
                .findByOrderId(orderId)
                .orElseThrow(() -> new NotFoundException("Согласование замеров не найдено"));

        MeasurementAgreementStatus newStatus = MeasurementAgreementStatus.fromValue(req.status());
        agreement.setStatus(newStatus);
        if (req.comment() != null) agreement.setStaffComment(req.comment());
        measurementAgreementRepository.save(agreement);

        appendHistory(order, "Статус согласования замеров → " + newStatus.getValue());
        return MeasurementAgreementResponse.from(agreement);
    }

    @Transactional
    public MeasurementAgreementResponse respondToMeasurementAgreement(String orderId,
                                                                        RespondMeasurementRequest req, User user) {
        Order order = getOrThrow(orderId);
        LaboratoryMeasurementAgreement agreement = measurementAgreementRepository
                .findByOrderId(orderId)
                .orElseThrow(() -> new NotFoundException("Согласование замеров не найдено"));

        MeasurementAgreementStatus newStatus = MeasurementAgreementStatus.fromValue(req.status());
        agreement.setStatus(newStatus);
        if (req.comment() != null) agreement.setClientComment(req.comment());
        if (req.rescheduleDate() != null) agreement.setRescheduleDate(req.rescheduleDate());
        if (req.rescheduleTime() != null) agreement.setRescheduleTime(req.rescheduleTime());
        if (req.rescheduleAddress() != null) agreement.setRescheduleAddress(req.rescheduleAddress());
        if (req.rescheduleComment() != null) agreement.setRescheduleComment(req.rescheduleComment());
        agreement.setRespondedAt(LocalDateTime.now());
        measurementAgreementRepository.save(agreement);

        appendHistory(order, "Клиент ответил на согласование замеров: " + newStatus.getValue());
        return MeasurementAgreementResponse.from(agreement);
    }

    // ── Lab results ──

    @Transactional
    public LabResultDocumentResponse uploadLabResult(String orderId,
                                                      UploadLabResultRequest req, User user) {
        Order order = getOrThrow(orderId);

        LaboratoryResultDocument doc = new LaboratoryResultDocument();
        doc.setOrder(order);
        doc.setName(req.name());
        doc.setSection(req.section());
        if (req.quarter() != null) {
            try { doc.setQuarter(Integer.parseInt(req.quarter())); }
            catch (NumberFormatException ignored) {}
        }
        doc.setFileName(req.fileName());
        doc.setStatus(LabResultDocumentStatus.uploaded);
        doc.setUploadedAt(LocalDateTime.now());
        labResultDocumentRepository.save(doc);

        appendHistory(order, "Загружен результат лаборатории: " + req.name());
        return LabResultDocumentResponse.from(doc);
    }

    @Transactional
    public LabResultDocumentResponse updateLabResultStatus(String orderId, Long docId,
                                                             UpdateLabResultStatusRequest req, User user) {
        Order order = getOrThrow(orderId);
        LaboratoryResultDocument doc = labResultDocumentRepository.findById(docId)
                .orElseThrow(() -> new NotFoundException("Результат не найден: " + docId));
        if (!doc.getOrder().getId().equals(orderId)) {
            throw new BadRequestException("Результат не принадлежит заявке");
        }

        LabResultDocumentStatus newStatus = LabResultDocumentStatus.fromValue(req.status());
        doc.setStatus(newStatus);
        if (req.comment() != null) doc.setStaffComment(req.comment());
        if (newStatus == LabResultDocumentStatus.approved) doc.setApprovedAt(LocalDateTime.now());
        labResultDocumentRepository.save(doc);

        appendHistory(order, "Статус результата «" + doc.getName() + "» → " + newStatus.getValue());
        return LabResultDocumentResponse.from(doc);
    }
}
