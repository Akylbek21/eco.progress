package kz.eco.lead;

import kz.eco.common.exception.NotFoundException;
import kz.eco.lead.dto.CreateLeadRequest;
import kz.eco.lead.dto.LeadResponse;
import kz.eco.lead.dto.UpdateLeadRequest;
import kz.eco.user.User;
import kz.eco.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class LeadService {

    private final LeadRepository leadRepository;
    private final UserRepository userRepository;

    public LeadService(LeadRepository leadRepository, UserRepository userRepository) {
        this.leadRepository = leadRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public LeadResponse create(CreateLeadRequest request) {
        Lead lead = new Lead();
        lead.setName(request.name());
        lead.setPhone(request.phone());
        lead.setCity(request.city());
        lead.setEmail(request.email());
        lead.setCompanyName(request.companyName());
        lead.setServiceId(coalesce(request.serviceType(), request.serviceId()));
        lead.setMessage(coalesce(request.comment(), request.message()));
        lead.setSource(request.source());
        lead.setStatus(LeadStatus.new_lead);
        leadRepository.save(lead);
        return LeadResponse.from(lead);
    }

    @Transactional(readOnly = true)
    public List<LeadResponse> findAll() {
        return leadRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(LeadResponse::from)
                .toList();
    }

    @Transactional
    public LeadResponse update(Long id, UpdateLeadRequest request) {
        Lead lead = leadRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Лид не найден: " + id));
        if (request.status() != null) {
            lead.setStatus(request.status());
        }
        if (request.assignedManagerId() != null) {
            User manager = userRepository.findById(request.assignedManagerId())
                    .orElseThrow(() -> new NotFoundException("Менеджер не найден"));
            lead.setAssignedManager(manager);
        }
        leadRepository.save(lead);
        return LeadResponse.from(lead);
    }

    private static String coalesce(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }
}
