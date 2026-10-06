package com.autoops.machine.service;
import com.autoops.machine.repository.MachineRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
@Service
public class SshHostTrustService {
  private final MachineRepository machines;
  public SshHostTrustService(MachineRepository machines){this.machines=machines;}
  public String fingerprint(String hostKey){
    try{return "SHA256:"+Base64.getEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(hostKey.getBytes(StandardCharsets.UTF_8)));}
    catch(Exception e){throw new IllegalStateException(e);}
  }
  @Transactional
  public void trust(Long machineId,String hostKey,String expectedFingerprint){
    var machine=machines.findById(machineId).orElseThrow();
    String actual=fingerprint(hostKey);
    if(!MessageDigest.isEqual(actual.getBytes(StandardCharsets.UTF_8),expectedFingerprint.getBytes(StandardCharsets.UTF_8)))throw new IllegalArgumentException("SSH fingerprint mismatch");
    machine.trust("unknown",hostKey,actual);machines.save(machine);
  }
  @Transactional(readOnly=true)
  public void verify(Long machineId,String presentedHostKey){
    var machine=machines.findById(machineId).orElseThrow();
    if(machine.getSshHostKey()==null||machine.getSshFingerprint()==null)throw new IllegalStateException("SSH host is not trusted");
    String actual=fingerprint(presentedHostKey);
    if(!MessageDigest.isEqual(actual.getBytes(StandardCharsets.UTF_8),machine.getSshFingerprint().getBytes(StandardCharsets.UTF_8)))throw new SecurityException("SSH host key changed");
  }
}
