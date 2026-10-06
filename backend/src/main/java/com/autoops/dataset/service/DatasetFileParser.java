package com.autoops.dataset.service;
import org.springframework.stereotype.Component;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
@Component
public class DatasetFileParser {
  public List<DatasetImportService.Row> csv(InputStream input)throws IOException{
    List<DatasetImportService.Row> rows=new ArrayList<>();
    try(var reader=new BufferedReader(new InputStreamReader(input,StandardCharsets.UTF_8))){
      String line; boolean first=true;
      while((line=reader.readLine())!=null){
        if(first){first=false;if(line.toLowerCase(Locale.ROOT).contains("command"))continue;}
        String[] parts=line.split(",",4);
        if(parts.length==4)rows.add(new DatasetImportService.Row(parts[0].trim(),parts[1].trim(),parts[2].trim(),parts[3].trim()));
      }
    }
    return rows;
  }
}
