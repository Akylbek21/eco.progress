package kz.eco.pek;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import java.io.*;
import java.util.*;
@Service
public class PekMonitoringExcelGenerationService {
 private final PekProgramControlItemRepository items; private final PekProgramIndicatorRepository indicators;
 public PekMonitoringExcelGenerationService(PekProgramControlItemRepository i,PekProgramIndicatorRepository p){items=i;indicators=p;}
 public byte[] generate(PekProgramMonitoring monitoring) {
  try(var book=new XSSFWorkbook();var out=new ByteArrayOutputStream()){
   var sheet=book.createSheet("План-факт"); String[] h={"Код","Точка/источник","Показатель","Единица","Норматив","Периодичность","План","Методика","Лаборатория"};var header=sheet.createRow(0);for(int x=0;x<h.length;x++)header.createCell(x).setCellValue(h[x]);int row=1;
   Map<Long,PekProgramControlItem> selected=new LinkedHashMap<>();items.findAllById(monitoring.getControlItemIds()).forEach(i->selected.put(i.getId(),i));
   for(var item:selected.values()){var rows=indicators.findByControlItemIdOrderBySortOrderAsc(item.getId());if(rows.isEmpty())row=write(sheet,row,item,null);else for(var indicator:rows)row=write(sheet,row,item,indicator);}
   for(int x=0;x<h.length;x++)sheet.autoSizeColumn(x);book.write(out);return out.toByteArray();
  }catch(IOException e){throw new IllegalStateException("Не удалось сформировать XLSX ПЭК",e);}
 }
 private int write(org.apache.poi.ss.usermodel.Sheet s,int n,PekProgramControlItem i,PekProgramIndicator p){var r=s.createRow(n++);r.createCell(0).setCellValue(i.getCode());r.createCell(1).setCellValue(i.getName());r.createCell(2).setCellValue(p==null?"":p.getIndicatorName());r.createCell(3).setCellValue(p==null||p.getUnit()==null?"":p.getUnit());r.createCell(4).setCellValue(p==null||p.getNormativeValue()==null?"":p.getNormativeValue().toPlainString());r.createCell(5).setCellValue(i.getFrequencyType()==null?"":i.getFrequencyType().name());r.createCell(6).setCellValue(i.getPlannedCount()==null?0:i.getPlannedCount());r.createCell(7).setCellValue(i.getMeasurementMethod()==null?"":i.getMeasurementMethod());r.createCell(8).setCellValue(i.getLaboratoryId()==null?"":i.getLaboratoryId().toString());return n;}
 public String fileName(PekMonitoringType t){return switch(t){case AMBIENT_AIR->"ПЭК_Атмосфера.xlsx";case EMISSION_SOURCE->"ПЭК_Выбросы.xlsx";case SURFACE_WATER->"ПЭК_Поверхностные_воды.xlsx";case GROUNDWATER->"ПЭК_Подземные_воды.xlsx";case WASTEWATER->"ПЭК_Сточные_воды.xlsx";case SOIL->"ПЭК_Почва.xlsx";case WASTE->"ПЭК_Отходы.xlsx";case PHYSICAL_FACTOR->"ПЭК_Физические_факторы.xlsx";};}
}
