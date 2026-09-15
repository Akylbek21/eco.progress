package kz.eco.content.dto;

import kz.eco.content.City;

/** All six Russian grammatical cases for a city - "данные для склонений" per the public contract,
 *  so the frontend never has to guess/generate a form itself. */
public record CityFormsDto(
        String slug,
        String nominative,
        String genitive,
        String dative,
        String accusative,
        String instrumental,
        String prepositional,
        String regionName
) {
    public static CityFormsDto from(City city) {
        return new CityFormsDto(
                city.getSlug(), city.getNominative(), city.getGenitive(), city.getDative(),
                city.getAccusative(), city.getInstrumental(), city.getPrepositional(), city.getRegionName());
    }
}
