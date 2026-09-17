package kz.eco.config;

import kz.eco.auth.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final Environment environment;

    @Value("${eco.cors.allowed-origins}")
    private String allowedOrigins;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, Environment environment) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.environment = environment;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Аутентификация в этом приложении идёт ТОЛЬКО через {@link JwtAuthenticationFilter}: токен
     * выпускает kz.eco.auth.AuthService, пользователи живут в своей таблице, а username/password
     * цепочка Spring Security не задействована - в {@link #securityFilterChain} нет ни formLogin,
     * ни httpBasic.
     *
     * <p>Без этого бина срабатывала автоконфигурация UserDetailsServiceAutoConfiguration: она
     * поднимала inMemoryUserDetailsManager с пользователем {@code user} и случайным паролем,
     * который печатался в лог при каждом старте ("Using generated security password"). Предъявить
     * его сейчас негде, но стоило бы кому-нибудь позже включить httpBasic (например, чтобы закрыть
     * actuator) - и в системе появился бы работающий аккаунт с паролем из логов.
     *
     * <p>Пустая реализация отключает эту автоконфигурацию и делает намерение явным: любая попытка
     * аутентифицироваться по логину/паролю через Spring Security - ошибка конфигурации, а не
     * штатный сценарий.
     */
    @Bean
    public UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException(
                    "Аутентификация по username/password не поддерживается: вход только по JWT");
        };
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        if (origins.contains("*")) {
            throw new IllegalStateException("Wildcard CORS origin is forbidden when credentials are enabled");
        } else {
            config.setAllowedOriginPatterns(origins);
        }
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        boolean production = environment.acceptsProfiles(Profiles.of("docker", "prod", "production"));
        http
                .cors(c -> c.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/services/**", "/api/news/**",
                                "/api/employees/**", "/api/tariffs/**", "/api/service-city/**",
                                "/api/public/content/**", "/sitemap.xml", "/robots.txt").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/leads").permitAll()
                        .requestMatchers("/h2-console/**").access((authentication, context) ->
                                new org.springframework.security.authorization.AuthorizationDecision(!production))
                        .requestMatchers("/error").permitAll()
                        // Document-flow external signer API: token-based (no JWT) by design - see
                        // kz.ecoprogress.documentflow.signing.api.PublicSigningController. Every
                        // handler still re-derives identity from the invitation token hash itself.
                        .requestMatchers("/api/public/document-flow/**").permitAll()
                        // CMS editorial workflow (articles/services/regions/experts/trust-documents):
                        // ADMIN+DIRECTOR, same tier as SecurityExpressions.NEWS_REVIEW/CITY_CONTENT_REVIEW/
                        // SERVICE_CONTENT_REVIEW/CONTENT_VERIFICATION - must be matched BEFORE the
                        // broader /api/admin/** ADMIN-only rule below, since Spring evaluates matchers
                        // in declaration order and the first match wins.
                        .requestMatchers("/api/admin/content/**").hasAnyRole("ADMIN", "DIRECTOR")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/staff/**")
                                .hasAnyRole("ADMIN", "DIRECTOR", "HEAD", "MANAGER", "ACCOUNTANT",
                                        "ECOLOGIST", "LABORATORY", "WASTE_SPECIALIST")
                        .requestMatchers("/api/client/**").hasAnyRole("CLIENT", "MANAGER", "ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll()
                )
                .headers(h -> h.frameOptions(f -> f.sameOrigin()))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(401);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            response.getWriter().write("{\"success\":false,\"data\":null,"
                                    + "\"message\":\"Не авторизован\",\"code\":\"UNAUTHORIZED\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(403);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            response.getWriter().write("{\"success\":false,\"data\":null,"
                                    + "\"message\":\"Недостаточно прав\",\"code\":\"ACCESS_DENIED\"}");
                        })
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
