package com.autoops.execution.plan;

import com.autoops.files.entity.StoredFile;
import com.autoops.files.service.StoredFileService;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FolderStepResolverTest {
    @Test void folderDestinationsAreExactAndReplacementIsHighRisk() {
        var files = mock(StoredFileService.class); var folder = new StoredFile();
        folder.setFolderName("app"); folder.setOriginalFilename("app.tar.gz"); folder.setSize(10L);
        when(files.requireUsable(1L, 5L)).thenReturn(folder);
        var resolver = new StepResolver(null, null, null, files);
        var def = new StepDefinition.FileTransfer(5L, "/srv/app/", true, false, 300);
        var result = resolver.resolve(new PlanStep("s1", 1L, "deploy", false, def, null, null), 1L);
        assertThat(result.destinationPath()).isEqualTo("/srv/app");
        assertThat(result.riskLevel()).isEqualTo("HIGH");
    }
    @Test void ordinaryFilesStillAppendTheirFilenameForDirectoryTargets() {
        assertThat(StepResolver.destination("/srv/app/", "config.json")).isEqualTo("/srv/app/config.json");
        assertThatThrownBy(() -> StepResolver.absolutePath("///", "Destination")).hasMessageContaining("root directory");
        assertThatThrownBy(() -> StepResolver.absolutePath("/srv/../etc", "Destination")).hasMessageContaining("segments");
    }
}
