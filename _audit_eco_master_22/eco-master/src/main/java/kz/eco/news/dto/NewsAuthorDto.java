package kz.eco.news.dto;

import kz.eco.user.User;

public record NewsAuthorDto(Long id, String name) {
    public static NewsAuthorDto from(User user) {
        return user == null ? null : new NewsAuthorDto(user.getId(), user.getName());
    }
}
