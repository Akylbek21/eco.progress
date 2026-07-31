package kz.eco.protocol;

import kz.eco.protocol.dto.ProtocolDtos;

final class ProtocolResultMapper {

    private ProtocolResultMapper() {
    }

    static void apply(ProtocolResult entity, ProtocolDtos.ProtocolResultRequest req) {
        if (req.rowNumber() != null) entity.setRowNumber(req.rowNumber());
        if (req.sampleDate() != null) entity.setSampleDate(req.sampleDate());
        if (req.samplingPlace() != null) entity.setSamplingPlace(req.samplingPlace());
        if (req.pollutionSourceNumber() != null) entity.setPollutionSourceNumber(req.pollutionSourceNumber());
        if (req.objectName() != null) entity.setObjectName(req.objectName());
        if (req.sampleName() != null) entity.setSampleName(req.sampleName());
        if (req.indicatorName() != null) entity.setIndicatorName(req.indicatorName());
        if (req.unit() != null) entity.setUnit(req.unit());
        if (req.testingMethodNd() != null) entity.setTestingMethodNd(req.testingMethodNd());
        if (req.samplingMethodNd() != null) entity.setSamplingMethodNd(req.samplingMethodNd());
        if (req.normativeValue() != null) entity.setNormativeValue(req.normativeValue());
        if (req.minValue() != null) entity.setMinValue(req.minValue());
        if (req.maxValue() != null) entity.setMaxValue(req.maxValue());
        if (req.resultValue() != null) entity.setResultValue(req.resultValue());
        if (req.note() != null) entity.setNote(req.note());
        if (req.temperatureC() != null) entity.setTemperatureC(req.temperatureC());
        if (req.flowSpeedMs() != null) entity.setFlowSpeedMs(req.flowSpeedMs());
        if (req.gasAirVolumeNm3s() != null) entity.setGasAirVolumeNm3s(req.gasAirVolumeNm3s());
        if (req.ductAreaM2() != null) entity.setDuctAreaM2(req.ductAreaM2());
        if (req.pdvMgM3() != null) entity.setPdvMgM3(req.pdvMgM3());
        if (req.pdvGs() != null) entity.setPdvGs(req.pdvGs());
        if (req.resultMgM3() != null) entity.setResultMgM3(req.resultMgM3());
        if (req.resultGs() != null) entity.setResultGs(req.resultGs());
        if (req.pdsMgDm3() != null) entity.setPdsMgDm3(req.pdsMgDm3());
        if (req.resultMgDm3() != null) entity.setResultMgDm3(req.resultMgDm3());
        if (req.pdkMgM3() != null) entity.setPdkMgM3(req.pdkMgM3());
        if (req.pdkOrBackground() != null) entity.setPdkOrBackground(req.pdkOrBackground());
        if (req.vehicleModel() != null) entity.setVehicleModel(req.vehicleModel());
        if (req.plateNumber() != null) entity.setPlateNumber(req.plateNumber());
        if (req.coPercent() != null) entity.setCoPercent(req.coPercent());
        if (req.chPpm() != null) entity.setChPpm(req.chPpm());
        if (req.smokeK() != null) entity.setSmokeK(req.smokeK());
        if (req.smokeNPercent() != null) entity.setSmokeNPercent(req.smokeNPercent());
        if (req.measurementPlace() != null) entity.setMeasurementPlace(req.measurementPlace());
        if (req.roomOrWorkplace() != null) entity.setRoomOrWorkplace(req.roomOrWorkplace());
        if (req.deviceId() != null) entity.setDeviceId(req.deviceId());
        if (req.verificationDate() != null) entity.setVerificationDate(req.verificationDate());
        if (req.verificationValidUntil() != null) entity.setVerificationValidUntil(req.verificationValidUntil());
    }

    static ProtocolResult copy(ProtocolResult source, Long newProtocolId, int rowNumber) {
        ProtocolResult copy = new ProtocolResult();
        copy.setProtocolId(newProtocolId);
        copy.setRowNumber(rowNumber);
        copy.setSampleDate(source.getSampleDate());
        copy.setSamplingPlace(source.getSamplingPlace());
        copy.setPollutionSourceNumber(source.getPollutionSourceNumber());
        copy.setObjectName(source.getObjectName());
        copy.setSampleName(source.getSampleName());
        copy.setIndicatorName(source.getIndicatorName());
        copy.setUnit(source.getUnit());
        copy.setTestingMethodNd(source.getTestingMethodNd());
        copy.setSamplingMethodNd(source.getSamplingMethodNd());
        copy.setNormativeId(source.getNormativeId());
        copy.setNormativeType(source.getNormativeType());
        copy.setNormativeValue(source.getNormativeValue());
        copy.setMinValue(source.getMinValue());
        copy.setMaxValue(source.getMaxValue());
        copy.setResultValue(source.getResultValue());
        copy.setComparisonType(source.getComparisonType());
        copy.setInternalStatus(source.getInternalStatus());
        copy.setNote(source.getNote());
        copy.setTemperatureC(source.getTemperatureC());
        copy.setFlowSpeedMs(source.getFlowSpeedMs());
        copy.setGasAirVolumeNm3s(source.getGasAirVolumeNm3s());
        copy.setDuctAreaM2(source.getDuctAreaM2());
        copy.setPdvMgM3(source.getPdvMgM3());
        copy.setPdvGs(source.getPdvGs());
        copy.setResultMgM3(source.getResultMgM3());
        copy.setResultGs(source.getResultGs());
        copy.setPdsMgDm3(source.getPdsMgDm3());
        copy.setResultMgDm3(source.getResultMgDm3());
        copy.setPdkMgM3(source.getPdkMgM3());
        copy.setPdkOrBackground(source.getPdkOrBackground());
        copy.setVehicleModel(source.getVehicleModel());
        copy.setPlateNumber(source.getPlateNumber());
        copy.setCoPercent(source.getCoPercent());
        copy.setChPpm(source.getChPpm());
        copy.setSmokeK(source.getSmokeK());
        copy.setSmokeNPercent(source.getSmokeNPercent());
        copy.setMeasurementPlace(source.getMeasurementPlace());
        copy.setRoomOrWorkplace(source.getRoomOrWorkplace());
        copy.setDirection(source.getDirection());
        copy.setExternalLaboratory(source.getExternalLaboratory());
        copy.setExternalLaboratoryName(source.getExternalLaboratoryName());
        copy.setSubtype(source.getSubtype());
        copy.setDeviceId(source.getDeviceId());
        copy.setVerificationDate(source.getVerificationDate());
        copy.setVerificationValidUntil(source.getVerificationValidUntil());
        copy.setPollutantCode(source.getPollutantCode());
        copy.setMethodTemplateId(source.getMethodTemplateId());
        copy.setUncertaintyValue(source.getUncertaintyValue());
        copy.setCalculationStatus(source.getCalculationStatus());
        copy.setCalculationMessage(source.getCalculationMessage());
        copy.setCalculatedAt(source.getCalculatedAt());
        // valuesJson carries extras that must survive a clone verbatim: the measurement-device
        // snapshot (deviceSnapshot in ProtocolService), normative search status, deviceWarning
        // flags, and any other extra fields not covered by named columns above.
        copy.setValuesJson(source.getValuesJson());
        return copy;
    }
}
