package kz.eco.pek;

import kz.eco.common.exception.BadRequestException;

import java.time.LocalDate;

public enum PekPeriodType {
    QUARTER,
    YEAR;

    /** Computes the period boundaries server-side - the client never gets to supply
     *  periodStart/periodEnd directly (spec: "Создание не должно принимать на доверие
     *  periodStart/periodEnd с frontend"). */
    public LocalDate[] boundsFor(int year, Integer quarter) {
        if (this == YEAR) {
            return new LocalDate[]{LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31)};
        }
        if (quarter == null || quarter < 1 || quarter > 4) {
            throw new BadRequestException("Для periodType=QUARTER укажите quarter от 1 до 4");
        }
        int startMonth = (quarter - 1) * 3 + 1;
        LocalDate start = LocalDate.of(year, startMonth, 1);
        LocalDate end = start.plusMonths(3).minusDays(1);
        return new LocalDate[]{start, end};
    }
}
