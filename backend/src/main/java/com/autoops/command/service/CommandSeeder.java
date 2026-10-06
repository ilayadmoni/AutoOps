package com.autoops.command.service;

import com.autoops.command.entity.CommandDefinition;
import com.autoops.command.repository.CommandDefinitionRepository;
import com.autoops.command.risk.CommandRiskAnalyzer;
import com.autoops.embedding.EmbeddingService;
import com.autoops.user.entity.User;
import com.autoops.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Seeds a small set of approved, common RHEL operations once an administrator exists. Idempotent. */
@Component
@Order(20)
public class CommandSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(CommandSeeder.class);
    private static final ParameterSpec SERVICE = new ParameterSpec("service", "Service name", "SERVICE", true, "systemd unit, e.g. nginx", List.of(), null);
    private static final ParameterSpec PATH = new ParameterSpec("path", "Path", "PATH", true, "Absolute path on the machine", List.of(), null);
    private static final ParameterSpec PACKAGE = new ParameterSpec("package", "Package", "PACKAGE", true, "RPM package name", List.of(), null);
    private static final ParameterSpec LINES = new ParameterSpec("lines", "Lines", "INTEGER", false, "Number of lines", List.of(), "100");

    private record Seed(String name, String description, String category, String action, String template, List<ParameterSpec> params) {
    }

    private static final List<Seed> SEEDS = List.of(
            new Seed("Show OS release", "Print the operating system name and version", "SYSTEM", "inspect", "cat /etc/os-release", List.of()),
            new Seed("Show uptime and load", "How long the machine has been running and its load averages", "SYSTEM", "inspect", "uptime", List.of()),
            new Seed("Show memory usage", "Memory and swap usage in megabytes", "SYSTEM", "inspect", "free -m", List.of()),
            new Seed("Show disk usage", "Free and used space per mounted filesystem", "STORAGE", "inspect", "df -h", List.of()),
            new Seed("Show directory size", "Total size of a directory", "STORAGE", "inspect", "du -sh {{path}}", List.of(PATH)),
            new Seed("List directory", "List files with permissions and owners", "FILES", "inspect", "ls -la {{path}}", List.of(PATH)),
            new Seed("Show file checksum", "SHA-256 checksum of a file", "FILES", "inspect", "sha256sum {{path}}", List.of(PATH)),
            new Seed("Show end of file", "Last lines of a text file", "FILES", "inspect", "tail -n {{lines}} {{path}}", List.of(LINES, PATH)),
            new Seed("Service status", "Detailed status of a systemd service", "SERVICES", "inspect", "systemctl status --no-pager {{service}}", List.of(SERVICE)),
            new Seed("Is service active", "Prints active/inactive for a systemd service", "SERVICES", "inspect", "systemctl is-active {{service}}", List.of(SERVICE)),
            new Seed("Service logs", "Recent journal entries for a service", "SERVICES", "inspect", "journalctl -u {{service}} -n {{lines}} --no-pager", List.of(SERVICE, LINES)),
            new Seed("Start service", "Start a systemd service", "SERVICES", "start", "systemctl start {{service}}", List.of(SERVICE)),
            new Seed("Stop service", "Stop a systemd service", "SERVICES", "stop", "systemctl stop {{service}}", List.of(SERVICE)),
            new Seed("Restart service", "Restart a systemd service", "SERVICES", "restart", "systemctl restart {{service}}", List.of(SERVICE)),
            new Seed("List listening ports", "TCP/UDP sockets in LISTEN state with owning processes", "NETWORK", "inspect", "ss -tulpn", List.of()),
            new Seed("Check package installed", "Show the installed version of an RPM package", "PACKAGES", "inspect", "rpm -q {{package}}", List.of(PACKAGE)),
            new Seed("Install package", "Install an RPM package with dnf", "PACKAGES", "install", "dnf install -y {{package}}", List.of(PACKAGE)),
            new Seed("Show SELinux mode", "Current SELinux enforcement mode", "SECURITY", "inspect", "getenforce", List.of()),
            new Seed("Reboot machine", "Reboot the machine immediately", "SYSTEM", "reboot", "systemctl reboot", List.of()));

    private final CommandDefinitionRepository repo;
    private final UserRepository users;
    private final CommandTemplateService templates;
    private final CommandRiskAnalyzer risk;
    private final EmbeddingService embeddings;

    public CommandSeeder(CommandDefinitionRepository repo, UserRepository users, CommandTemplateService templates,
                         CommandRiskAnalyzer risk, EmbeddingService embeddings) {
        this.repo = repo;
        this.users = users;
        this.templates = templates;
        this.risk = risk;
        this.embeddings = embeddings;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (repo.existsBySource("SYSTEM")) {
            return;
        }
        var admin = users.findByStatusNotOrderByUsernameAsc(User.Status.DELETED).stream()
                .filter(u -> u.getRole() == User.Role.ADMIN).findFirst();
        if (admin.isEmpty()) {
            return;
        }
        int created = 0;
        for (Seed s : SEEDS) {
            if (repo.existsByNormalizedTemplate(CommandDefinition.normalize(s.template()))) {
                continue;
            }
            var c = new CommandDefinition();
            c.setName(s.name());
            c.setDescription(s.description());
            c.setCategory(s.category());
            c.setAction(s.action());
            c.setCommandTemplate(s.template());
            c.setParametersSchema(templates.serialize(templates.validateTemplate(s.template(), s.params())));
            var r = risk.analyze(s.template());
            c.setRiskLevel(r.name());
            c.setRequiresApproval(r == CommandRiskAnalyzer.Risk.HIGH);
            c.setSource("SYSTEM");
            c.setSupportedOs("RHEL");
            c.setStatus(CommandDefinition.APPROVED);
            c.setCreatedBy(admin.get().getId());
            c.setApprovedBy(admin.get().getId());
            c.setApprovedAt(Instant.now());
            embeddings.index(repo.save(c));
            created++;
        }
        log.info("Seeded {} built-in RHEL commands", created);
    }
}
