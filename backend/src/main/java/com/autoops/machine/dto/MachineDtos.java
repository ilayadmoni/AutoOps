package com.autoops.machine.dto;
import jakarta.validation.constraints.*;
public final class MachineDtos { private MachineDtos(){} public record Create(@NotBlank String name,@NotBlank String hostname,@Min(1) @Max(65535) Integer sshPort,String operatingSystem,String osVersion){} public record Response(Long id,String name,String hostname,Integer sshPort,String operatingSystem,String osVersion){} }
