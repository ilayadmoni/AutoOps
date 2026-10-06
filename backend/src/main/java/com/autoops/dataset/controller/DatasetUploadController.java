package com.autoops.dataset.controller;
import com.autoops.common.security.CurrentUser;
import com.autoops.dataset.entity.DatasetImport;
import com.autoops.dataset.repository.DatasetImportRepository;
import com.autoops.dataset.service.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RestController
@RequestMapping("/api/admin/datasets")
public class DatasetUploadController {
  private final DatasetImportRepository repo; private final DatasetFileParser parser; private final DatasetImportService imports; private final CurrentUser current;
  public DatasetUploadController(DatasetImportRepository r,DatasetFileParser p,DatasetImportService i,CurrentUser c){repo=r;parser=p;imports=i;current=c;}
  @PostMapping(value="/upload",consumes="multipart/form-data")
  public DatasetImport upload(@RequestPart("file") MultipartFile file)throws Exception{
    if(file.isEmpty())throw new IllegalArgumentException("Dataset file required");
    var d=new DatasetImport(); d.setFilename(file.getOriginalFilename()); d.setUploadedBy(current.id()); d.setStatus("ANALYZING"); d=repo.save(d);
    var rows=parser.csv(file.getInputStream()); d.setStatus("READY"); repo.save(d);
    return imports.importRows(d.getId(),rows);
  }
}
