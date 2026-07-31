package kz.eco.services.dto;

import kz.eco.services.EcoService;

import java.util.List;

public record EcoServiceResponse(
        String id,
        String title,
        String category,
        String description,
        String forWhom,
        String result,
        List<String> includes,
        List<String> documents,
        List<String> workflow,
        String duration,
        String icon
) {
    public static EcoServiceResponse from(EcoService entity) {
        return new EcoServiceResponse(
                entity.getId(),
                entity.getTitle(),
                entity.getCategory().getLabel(),
                entity.getDescription(),
                entity.getForWhom(),
                entity.getResult(),
                List.copyOf(entity.getIncludes()),
                List.copyOf(entity.getDocuments()),
                List.copyOf(entity.getWorkflow()),
                entity.getDuration(),
                entity.getIcon()
        );
    }
}
