package kz.eco.storage;

import com.mongodb.client.gridfs.model.GridFSFile;
import kz.eco.common.exception.NotFoundException;
import kz.eco.config.DockerStartupReport;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);

    private final GridFsTemplate gridFsTemplate;
    private final ObjectMapper objectMapper;
    private final Path uploadDirectory;
    private final StorageBackend backend;

    public FileStorageService(
            @Autowired(required = false) GridFsTemplate gridFsTemplate,
            ObjectMapper objectMapper,
            @Value("${eco.storage.directory:./data/uploads}") String uploadDirectory,
            @Value("${eco.storage.backend:auto}") String backendName) throws IOException {
        this.gridFsTemplate = gridFsTemplate;
        this.objectMapper = objectMapper;
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
        this.backend = StorageBackend.from(backendName);
        Files.createDirectories(this.uploadDirectory);
        log.warn("{} storage backend={} directory={}", DockerStartupReport.MARKER, this.backend, this.uploadDirectory);
    }

    public StoredFileMetadata storeBytes(byte[] content, String filename, String contentType,
                                       String contextId, String uploadedBy) throws IOException {
        if (backend == StorageBackend.FILESYSTEM) {
            return storeBytesOnDisk(content, filename, contentType, contextId, uploadedBy);
        }
        try {
            return storeBytesInGridFs(content, filename, contentType, contextId, uploadedBy);
        } catch (RuntimeException ex) {
            if (backend == StorageBackend.GRIDFS || !MongoConnectionFailures.isConnectionFailure(ex)) {
                throw ex;
            }
            log.warn("GridFS недоступен ({}), сохраняем файл на диск", ex.getMessage());
            return storeBytesOnDisk(content, filename, contentType, contextId, uploadedBy);
        }
    }

    public StoredFileMetadata store(MultipartFile file, String orderId, String uploadedBy) throws IOException {
        if (backend == StorageBackend.FILESYSTEM) {
            return storeOnDisk(file, orderId, uploadedBy);
        }
        try {
            return storeInGridFs(file, orderId, uploadedBy);
        } catch (RuntimeException ex) {
            if (backend == StorageBackend.GRIDFS || !MongoConnectionFailures.isConnectionFailure(ex)) {
                throw ex;
            }
            log.warn("GridFS недоступен ({}), сохраняем файл на диск", ex.getMessage());
            return storeOnDisk(file, orderId, uploadedBy);
        }
    }

    public StoredFileContent load(String fileId) throws IOException {
        Path diskFile = resolveDataFile(fileId);
        if (Files.isRegularFile(diskFile)) {
            return loadFromDisk(fileId, diskFile);
        }
        if (backend == StorageBackend.FILESYSTEM) {
            throw new NotFoundException("Файл не найден: " + fileId);
        }
        try {
            return loadFromGridFs(fileId);
        } catch (RuntimeException ex) {
            if (Files.isRegularFile(diskFile)) {
                return loadFromDisk(fileId, diskFile);
            }
            throw ex;
        }
    }

    public void delete(String fileId) {
        try {
            deleteInternal(fileId);
        } catch (IOException ex) {
            throw new IllegalStateException("Не удалось удалить файл: " + fileId, ex);
        }
    }

    private void deleteInternal(String fileId) throws IOException {
        Path diskFile = resolveDataFile(fileId);
        Path metaFile = resolveMetaFile(fileId);
        boolean deletedOnDisk = false;
        if (Files.isRegularFile(diskFile)) {
            Files.delete(diskFile);
            deletedOnDisk = true;
        }
        if (Files.isRegularFile(metaFile)) {
            Files.delete(metaFile);
            deletedOnDisk = true;
        }
        if (deletedOnDisk || backend == StorageBackend.FILESYSTEM) {
            return;
        }
        if (gridFsTemplate != null && ObjectId.isValid(fileId)) {
            gridFsTemplate.delete(new Query(Criteria.where("_id").is(new ObjectId(fileId))));
        }
    }

    private StoredFileMetadata storeBytesInGridFs(byte[] content, String filename, String contentType,
                                                  String contextId, String uploadedBy) throws IOException {
        if (gridFsTemplate == null) {
            throw new IllegalStateException("GridFS не настроен");
        }
        Document metadata = new Document()
                .append("contextId", contextId)
                .append("uploadedBy", uploadedBy)
                .append("originalName", filename);

        ObjectId id = gridFsTemplate.store(
                new java.io.ByteArrayInputStream(content),
                filename,
                contentType != null ? contentType : "application/octet-stream",
                metadata
        );
        return new StoredFileMetadata(id.toHexString(), filename, contentType, content.length);
    }

    private StoredFileMetadata storeBytesOnDisk(byte[] content, String filename, String contentType,
                                                 String contextId, String uploadedBy) throws IOException {
        String fileId = new ObjectId().toHexString();
        Path dataFile = resolveDataFile(fileId);
        Path metaFile = resolveMetaFile(fileId);
        Files.write(dataFile, content);
        DiskFileMeta meta = new DiskFileMeta(contextId, uploadedBy, filename, contentType, content.length);
        objectMapper.writeValue(metaFile.toFile(), meta);
        return new StoredFileMetadata(fileId, filename, contentType, content.length);
    }

    private StoredFileMetadata storeInGridFs(MultipartFile file, String orderId, String uploadedBy) throws IOException {
        if (gridFsTemplate == null) {
            throw new IllegalStateException("GridFS не настроен");
        }
        Document metadata = new Document()
                .append("orderId", orderId)
                .append("uploadedBy", uploadedBy)
                .append("originalName", file.getOriginalFilename());

        ObjectId id = gridFsTemplate.store(
                file.getInputStream(),
                file.getOriginalFilename(),
                file.getContentType(),
                metadata
        );

        return new StoredFileMetadata(
                id.toHexString(),
                file.getOriginalFilename(),
                file.getContentType(),
                file.getSize()
        );
    }

    private StoredFileMetadata storeOnDisk(MultipartFile file, String orderId, String uploadedBy) throws IOException {
        String fileId = new ObjectId().toHexString();
        Path dataFile = resolveDataFile(fileId);
        Path metaFile = resolveMetaFile(fileId);

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, dataFile, StandardCopyOption.REPLACE_EXISTING);
        }

        DiskFileMeta meta = new DiskFileMeta(
                orderId,
                uploadedBy,
                file.getOriginalFilename(),
                file.getContentType(),
                file.getSize()
        );
        objectMapper.writeValue(metaFile.toFile(), meta);

        return new StoredFileMetadata(
                fileId,
                file.getOriginalFilename(),
                file.getContentType(),
                file.getSize()
        );
    }

    private StoredFileContent loadFromGridFs(String fileId) throws IOException {
        if (gridFsTemplate == null) {
            throw new NotFoundException("Файл не найден: " + fileId);
        }
        GridFSFile file = gridFsTemplate.findOne(
                new Query(Criteria.where("_id").is(new ObjectId(fileId)))
        );
        if (file == null) {
            throw new NotFoundException("Файл не найден: " + fileId);
        }
        GridFsResource resource = gridFsTemplate.getResource(file);
        String filename = resource.getFilename() != null ? resource.getFilename() : "document";
        String contentType = resource.getContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "application/octet-stream";
        }
        return new StoredFileContent(filename, contentType, resource.getInputStream());
    }

    private StoredFileContent loadFromDisk(String fileId, Path dataFile) throws IOException {
        DiskFileMeta meta = readMeta(fileId);
        String filename = meta.originalName() != null ? meta.originalName() : "document";
        String contentType = meta.contentType() != null && !meta.contentType().isBlank()
                ? meta.contentType()
                : "application/octet-stream";
        return new StoredFileContent(filename, contentType, Files.newInputStream(dataFile));
    }

    private DiskFileMeta readMeta(String fileId) throws IOException {
        Path metaFile = resolveMetaFile(fileId);
        if (!Files.isRegularFile(metaFile)) {
            return new DiskFileMeta(null, null, "document", "application/octet-stream", 0);
        }
        return objectMapper.readValue(metaFile.toFile(), DiskFileMeta.class);
    }

    private Path resolveDataFile(String fileId) {
        return uploadDirectory.resolve(fileId);
    }

    private Path resolveMetaFile(String fileId) {
        return uploadDirectory.resolve(fileId + ".meta.json");
    }

    private enum StorageBackend {
        AUTO, GRIDFS, FILESYSTEM;

        static StorageBackend from(String value) {
            if (value == null || value.isBlank()) {
                return AUTO;
            }
            return switch (value.trim().toLowerCase()) {
                case "gridfs", "mongo", "mongodb" -> GRIDFS;
                case "filesystem", "disk", "local" -> FILESYSTEM;
                default -> AUTO;
            };
        }
    }

    private record DiskFileMeta(
            String orderId,
            String uploadedBy,
            String originalName,
            String contentType,
            long size
    ) {
    }
}
