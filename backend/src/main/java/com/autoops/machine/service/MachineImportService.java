package com.autoops.machine.service;

import com.autoops.common.error.ApiException;
import com.autoops.machine.dto.MachineImportDtos.*;
import com.autoops.machine.repository.MachineRepository;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class MachineImportService {
    private final MobaSessionParser parser;
    private final MachineRepository repo;
    private final MachineImportRowService writer;

    public MachineImportService(MobaSessionParser parser, MachineRepository repo, MachineImportRowService writer) {
        this.parser = parser;
        this.repo = repo;
        this.writer = writer;
    }

    public Preview preview(byte[] file) {
        Set<String> seen = new HashSet<>();
        repo.findByDeletedAtIsNullOrderByNameAsc().forEach(m -> seen.add(MobaSessionFields.endpoint(m.getHostname(), m.getSshPort())));
        return new Preview(parser.parse(file).stream().map(row -> {
            if (row.skipReason() != null) return row;
            return seen.add(MobaSessionFields.endpoint(row.hostname(), row.sshPort())) ? row : row.skipped("DUPLICATE");
        }).toList());
    }

    public Result execute(Long userId, byte[] file, Request request) {
        List<Row> rows = preview(file).rows();
        Map<Integer, Selection> selections = new HashMap<>();
        for (Selection selection : request.selections()) {
            if (selection.index() < 0 || selection.index() >= rows.size() || selections.putIfAbsent(selection.index(), selection) != null)
                throw ApiException.validation("Invalid or repeated session selection");
        }
        List<Outcome> outcomes = new ArrayList<>();
        for (Row row : rows) {
            Selection selection = selections.get(row.index());
            String reason = row.skipReason() != null ? row.skipReason() : selection == null ? "NOT_SELECTED" : null;
            if (reason != null) {
                outcomes.add(new Outcome(row.index(), row.name(), "SKIPPED", reason, null));
                continue;
            }
            try { outcomes.add(writer.create(userId, row, selection)); }
            catch (ApiException e) {
                String reasonCode = java.util.Set.of("CREDENTIAL_AMBIGUOUS", "CREDENTIAL_USERNAME_MISMATCH").contains(e.code())
                        ? e.code() : "IMPORT_FAILED";
                outcomes.add(new Outcome(row.index(), row.name(), "FAILED", reasonCode, null));
            }
            catch (Exception e) {
                // Never return DB errors or request/credential objects to the browser.
                outcomes.add(new Outcome(row.index(), row.name(), "FAILED", "IMPORT_FAILED", null));
            }
        }
        return new Result(count(outcomes, "IMPORTED"), count(outcomes, "SKIPPED"), count(outcomes, "FAILED"), List.copyOf(outcomes));
    }

    private static long count(List<Outcome> outcomes, String status) {
        return outcomes.stream().filter(o -> o.status().equals(status)).count();
    }
}
