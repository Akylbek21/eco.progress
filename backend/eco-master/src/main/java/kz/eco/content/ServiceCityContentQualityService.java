package kz.eco.content;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Everything that guards against "scaled content" city pages: a page must have real, unique,
 *  grammatically-correct regional text before it is allowed to become indexable. This is what
 *  makes ServiceCityPageService#approve()/publish() refuse a weak page rather than a human simply
 *  forgetting to check - see requireQualityPassed() in that class. */
@Service
public class ServiceCityContentQualityService {

    /** Below this, a "regional" paragraph reads as a one-line stub, not real unique content. */
    private static final int MIN_REGIONAL_TEXT_LENGTH = 120;

    /** Above this Jaccard similarity (5-word shingles) two pages are considered the same template
     *  with the city name swapped, not genuinely differentiated content. */
    private static final double DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

    private static final int SHINGLE_SIZE = 5;

    private final ServiceCityPageRepository pageRepository;
    private final CityRepository cityRepository;

    public ServiceCityContentQualityService(ServiceCityPageRepository pageRepository, CityRepository cityRepository) {
        this.pageRepository = pageRepository;
        this.cityRepository = cityRepository;
    }

    /** Runs every check, writes the pass/fail + issue list onto the page, and returns whether it
     *  passed. Does NOT save - callers decide when to persist. */
    public boolean check(ServiceCityPage page) {
        List<String> issues = new ArrayList<>();

        checkUniqueRegionalText(page, issues);
        checkLocalFaq(page, issues);
        City city = cityRepository.findById(page.getCitySlug()).orElse(null);
        if (city == null) {
            issues.add("Город \"" + page.getCitySlug() + "\" не найден в справочнике");
        } else {
            checkDeclension(page, city, issues);
        }
        checkNotDuplicate(page, issues);

        page.setQualityIssues(issues);
        boolean passed = issues.isEmpty();
        page.setContentQualityPassed(passed);
        return passed;
    }

    private void checkUniqueRegionalText(ServiceCityPage page, List<String> issues) {
        String joined = String.join(" ", page.getRegionalBlocks()).trim();
        if (joined.isBlank()) {
            issues.add("Нет уникального регионального текста");
        } else if (joined.length() < MIN_REGIONAL_TEXT_LENGTH) {
            issues.add("Региональный текст слишком короткий (" + joined.length()
                    + " символов, минимум " + MIN_REGIONAL_TEXT_LENGTH + ")");
        }
    }

    private void checkLocalFaq(ServiceCityPage page, List<String> issues) {
        boolean hasUsefulBlock = !page.getLocalFaq().isEmpty() || !page.getCases().isEmpty();
        if (!hasUsefulBlock) {
            issues.add("Нет локального FAQ или полезного блока (кейсов)");
        }
    }

    /** Flags the exact mistake called out in the acceptance criteria: "в Семея"/"из Семея" used
     *  where the correctly-declined form ("в Семее"/genitive "Семея" only after "из"/"до" etc.)
     *  was required. Detects nominative-form leakage into a prepositional("в ")/genitive("из ")
     *  slot when the city is NOT indeclinable (nominative differs from that case's real form). */
    private void checkDeclension(ServiceCityPage page, City city, List<String> issues) {
        String text = String.join(" ", page.getRegionalBlocks());
        checkWrongCase(text, "в", city.getNominative(), city.getPrepositional(), issues);
        checkWrongCase(text, "из", city.getNominative(), city.getGenitive(), issues);
        checkWrongCase(text, "по", city.getNominative(), city.getDative(), issues);
        checkWrongCase(text, "к", city.getNominative(), city.getDative(), issues);
    }

    private void checkWrongCase(String text, String preposition, String nominative, String correctForm, List<String> issues) {
        if (nominative.equalsIgnoreCase(correctForm)) {
            return; // indeclinable city (e.g. Алматы, Актобе) - nominative is always correct here
        }
        // (?U) switches \b/\w to Unicode-aware matching (Pattern.UNICODE_CHARACTER_CLASS) - without
        // it, Java's \w is ASCII-only, so Cyrillic letters count as "non-word" chars and \b never
        // matches around a Cyrillic city name at all, silently disabling this whole check.
        Pattern wrongPattern = Pattern.compile(
                "(?iU)\\b" + Pattern.quote(preposition) + "\\s+" + Pattern.quote(nominative) + "\\b");
        Matcher matcher = wrongPattern.matcher(text);
        if (matcher.find()) {
            issues.add("Некорректная форма города: \"" + preposition + " " + nominative
                    + "\" - должно быть \"" + preposition + " " + correctForm + "\"");
        }
    }

    private void checkNotDuplicate(ServiceCityPage page, List<String> issues) {
        String thisText = String.join(" ", page.getRegionalBlocks());
        Set<String> thisShingles = shingles(thisText);
        if (thisShingles.isEmpty()) {
            return; // already flagged as missing text above
        }
        for (ServiceCityPage other : pageRepository.findAllByServiceId(page.getServiceId())) {
            if (page.getId() != null && page.getId().equals(other.getId())) {
                continue;
            }
            if (other.getCitySlug().equals(page.getCitySlug())) {
                continue;
            }
            Set<String> otherShingles = shingles(String.join(" ", other.getRegionalBlocks()));
            double similarity = jaccard(thisShingles, otherShingles);
            if (similarity > DUPLICATE_SIMILARITY_THRESHOLD) {
                issues.add("Контент почти полностью совпадает со страницей города \""
                        + other.getCitySlug() + "\" (похожесть " + Math.round(similarity * 100) + "%)");
            }
        }
    }

    private Set<String> shingles(String text) {
        String[] words = normalize(text).split("\\s+");
        Set<String> result = new HashSet<>();
        if (words.length < SHINGLE_SIZE) {
            if (words.length > 0 && !words[0].isBlank()) {
                result.add(String.join(" ", words));
            }
            return result;
        }
        for (int i = 0; i <= words.length - SHINGLE_SIZE; i++) {
            result.add(String.join(" ", java.util.Arrays.asList(words).subList(i, i + SHINGLE_SIZE)));
        }
        return result;
    }

    private String normalize(String text) {
        return text.toLowerCase(Locale.forLanguageTag("ru-RU"))
                .replaceAll("[^\\p{IsCyrillic}\\p{IsLatin}0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return 0.0;
        }
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return (double) intersection.size() / union.size();
    }
}
