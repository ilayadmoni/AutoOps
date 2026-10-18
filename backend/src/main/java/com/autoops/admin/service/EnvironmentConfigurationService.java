package com.autoops.admin.service;

import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Properties;
import java.util.regex.Pattern;

/** Only application-declared settings are exposed. Never enumerate the host environment or read arbitrary files. */
@Service
public class EnvironmentConfigurationService {
    private static final Pattern VARIABLE = Pattern.compile("^\\$\\{([A-Z][A-Z0-9_]*)(?::(.*))?}$");
    private static final Pattern SECRET = Pattern.compile("PASSWORD|SECRET|TOKEN|API_KEY|ACCESS_KEY|ENCRYPTION_KEY");
    private final Environment environment;
    private final Properties declared;

    public EnvironmentConfigurationService(Environment environment) {
        this.environment = environment;
        var yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        declared = yaml.getObject();
    }

    public record Setting(String name, String property, String value, boolean configured, boolean masked) {}

    public List<Setting> settings() {
        return declared.stringPropertyNames().stream()
                .filter(property -> VARIABLE.matcher(declared.getProperty(property)).matches())
                .map(this::setting)
                .sorted(Comparator.comparing(Setting::name))
                .toList();
    }

    private Setting setting(String property) {
        var match = VARIABLE.matcher(declared.getProperty(property));
        if (!match.matches()) throw new IllegalArgumentException("Not an environment setting");
        String name = match.group(1);
        String value = environment.getProperty(property);
        if (value == null) value = environment.getProperty(name, match.group(2) == null ? "" : match.group(2));
        boolean configured = !value.isBlank();
        // URLs may embed credentials in user-info, query parameters or fragments. Hide the whole value in that case.
        boolean masked = SECRET.matcher(name).find()
                || ((name.endsWith("URL") || name.endsWith("ENDPOINT")) && value.matches("(?s).*[@?#].*"));
        return new Setting(name, property, masked ? null : value, configured, masked);
    }
}
