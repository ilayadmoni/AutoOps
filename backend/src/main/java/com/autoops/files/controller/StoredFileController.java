package com.autoops.files.controller;
import com.autoops.common.security.CurrentUser;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.service.StoredFileService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
@RestController
@RequestMapping("/api/files")
public class StoredFileController {
  private final StoredFileService files; private final CurrentUser current;
  public StoredFileController(StoredFileService files,CurrentUser current){this.files=files;this.current=current;}
  public record FileView(Long id,String filename,long size,String checksum){
    static FileView from(StoredFile f){return new FileView(f.getId(),f.getOriginalFilename(),f.getSize(),f.getChecksum());}
  }
  @PostMapping(consumes="multipart/form-data")
  public FileView upload(@RequestPart("file") MultipartFile file){return FileView.from(files.upload(file,current.id()));}
  @GetMapping("/{id}")
  public FileView get(@PathVariable Long id){return FileView.from(files.get(id,current.id()));}
  @GetMapping("/{id}/content")
  public ResponseEntity<InputStreamResource> download(@PathVariable Long id){
    StoredFile f=files.get(id,current.id());
    return ResponseEntity.ok().contentLength(f.getSize()).body(new InputStreamResource(files.download(id,current.id())));
  }
}
