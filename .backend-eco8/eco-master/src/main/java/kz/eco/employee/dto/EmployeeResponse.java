package kz.eco.employee.dto;

import kz.eco.employee.Employee;

public record EmployeeResponse(
        String id,
        String name,
        String position,
        String experience,
        String specialty,
        String summary,
        String avatar
) {
    public static EmployeeResponse from(Employee e) {
        return new EmployeeResponse(
                e.getId(), e.getName(), e.getPosition(), e.getExperience(),
                e.getSpecialty(), e.getSummary(), e.getAvatar()
        );
    }
}
