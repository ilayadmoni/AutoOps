package com.autoops.files.service;
import com.autoops.files.entity.StoredFile;
import com.autoops.files.repository.StoredFileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
@Service
public class StoredFileService {
  private final StoredFileRepository repo;
  private final ObjectStorageService storage;
  public StoredFileService(StoredFileRepository repo,ObjectStorageService storage){this.repo=repo;this.storage=storage;}
  @Transactional
  public StoredFile upload(MultipartFile file,Long userId){
    if(file==null||file.isEmpty())throw new IllegalArgumentException("File is required");
    try{
      byte[] bytes=file.getBytes();
      String checksum=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
      String key=userId+"/"+UUID.randomUUID();
      storage.put(key,new ByteArrayInputStream(bytes),bytes.length,file.getContentType()==null?"application/octet-stream":file.getContentType());
      StoredFile stored=new StoredFile();
      stored.setOriginalFilename(file.getOriginalFilename()==null?"upload":file.getOriginalFilename());
      stored.setObjectKey(key);stored.setSize((long)bytes.length);stored.setChecksum(checksum);stored.setCreatedBy(userId);
      return repo.save(stored);
    }catch(IOException e){throw new IllegalStateException("Unable to read upload",e);}
    catch(Exception e){throw new IllegalStateException("Unable to checksum upload",e);}
  }
  public StoredFile get(Long id,Long userId){
    StoredFile file=repo.findById(id).orElseThrow();
    if(!file.getCreatedBy().equals(userId))throw new SecurityException("File does not belong to current user");
    return file;
  }
  public InputStream download(Long id,Long userId){return storage.get(get(id,userId).getObjectKey());}
}
