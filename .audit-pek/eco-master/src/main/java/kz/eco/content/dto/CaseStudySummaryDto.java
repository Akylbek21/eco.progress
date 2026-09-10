package kz.eco.content.dto;

import kz.eco.content.CaseStudy;

/** Lightweight embed used when linking a case study from a service or region page (module fix
 *  item 2: "service/city pages связываются с релевантными кейсами") - not the full case body. */
public record CaseStudySummaryDto(String id, String title, String summary, String url) {
    public static CaseStudySummaryDto from(CaseStudy c, String url) {
        return new CaseStudySummaryDto(c.getId(), c.getTitle(), c.getSummary(), url);
    }
}
