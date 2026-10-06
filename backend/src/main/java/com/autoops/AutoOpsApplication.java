package com.autoops;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
@SpringBootApplication @EnableScheduling public class AutoOpsApplication { public static void main(String[] args){ SpringApplication.run(AutoOpsApplication.class,args); } }
