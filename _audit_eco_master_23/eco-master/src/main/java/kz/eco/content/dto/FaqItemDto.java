package kz.eco.content.dto;

import kz.eco.content.FaqItem;

public record FaqItemDto(String question, String answer) {
    public static FaqItemDto from(FaqItem item) {
        return new FaqItemDto(item.getQuestion(), item.getAnswer());
    }
}
