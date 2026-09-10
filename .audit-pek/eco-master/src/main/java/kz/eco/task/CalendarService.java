package kz.eco.task;

import kz.eco.order.LaboratoryMeasurementAgreement;
import kz.eco.order.LaboratoryMeasurementAgreementRepository;
import kz.eco.order.Order;
import kz.eco.order.OrderRepository;
import kz.eco.task.dto.CalendarEventResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class CalendarService {

    private final OrderRepository orderRepository;
    private final StaffTaskRepository taskRepository;
    private final LaboratoryMeasurementAgreementRepository measurementRepository;

    public CalendarService(OrderRepository orderRepository,
                           StaffTaskRepository taskRepository,
                           LaboratoryMeasurementAgreementRepository measurementRepository) {
        this.orderRepository = orderRepository;
        this.taskRepository = taskRepository;
        this.measurementRepository = measurementRepository;
    }

    @Transactional(readOnly = true)
    public List<CalendarEventResponse> events() {
        List<CalendarEventResponse> events = new ArrayList<>();

        for (Order o : orderRepository.findAll()) {
            if (o.getDeadline() != null) {
                events.add(new CalendarEventResponse(
                        "order-deadline-" + o.getId(),
                        "order_deadline",
                        "Дедлайн: " + o.getServiceName(),
                        o.getDeadline().toString(),
                        o.getId(),
                        o.getStatus().name()
                ));
            }
        }

        for (StaffTask t : taskRepository.findAllByOrderByDueDateAscCreatedAtDesc()) {
            if (t.getDueDate() != null) {
                events.add(new CalendarEventResponse(
                        "task-" + t.getId(),
                        "task",
                        t.getTitle(),
                        t.getDueDate().toString(),
                        t.getOrderId(),
                        t.getStatus().name()
                ));
            }
        }

        for (LaboratoryMeasurementAgreement m : measurementRepository.findAll()) {
            if (m.getDate() != null && !m.getDate().isBlank()) {
                String orderId = m.getOrder() != null ? m.getOrder().getId() : null;
                events.add(new CalendarEventResponse(
                        "measurement-" + m.getId(),
                        "measurement",
                        "Согласование замера",
                        m.getDate(),
                        orderId,
                        m.getStatus() != null ? m.getStatus().name() : null
                ));
            }
        }

        return events;
    }
}
