# MinIO Integration with TaaskMaaster

This document describes the MinIO object storage integration with the TaaskMaaster media system.

## Overview

TaaskMaaster uses MinIO as the object storage backend for media attachments, providing scalable and reliable file storage with S3-compatible APIs.

## Architecture

### Components

1. **MinIOStorageService** (`app/services/storage_service.py`)
   - Core MinIO client wrapper
   - Handles file upload, download, and management
   - Provides presigned URL generation

2. **MediaService** (`app/services/media_service.py`)
   - Enhanced with MinIO integration
   - Manages media attachments with MinIO storage
   - Provides high-level file operations

3. **Media API** (`app/api/media.py`)
   - RESTful endpoints for file operations
   - Presigned URL generation for direct uploads/downloads
   - MinIO statistics and monitoring

4. **Main Application** (`app/main.py`)
   - MinIO service initialization on startup
   - Graceful shutdown handling

## Features

### File Operations
- ✅ File upload to MinIO with metadata
- ✅ File download from MinIO
- ✅ File deletion from MinIO
- ✅ File existence checking
- ✅ File information retrieval

### Presigned URLs
- ✅ Download URL generation for secure file access
- ✅ Upload URL generation for direct client uploads
- ✅ Configurable expiration times
- ✅ Access control integration

### Storage Management
- ✅ Automatic bucket creation
- ✅ Storage statistics and monitoring
- ✅ File metadata management
- ✅ User-based file organization

### API Endpoints
- ✅ `GET /api/v1/media/minio-statistics` - Storage statistics
- ✅ `GET /api/v1/media/attachments/{id}/download-url` - Download URL
- ✅ `POST /api/v1/media/upload-url` - Upload URL generation
- ✅ `DELETE /api/v1/media/attachments/{id}` - File deletion

## Configuration

### Environment Variables

```bash
# MinIO Configuration
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET_NAME=taaskmaaster-media
MINIO_SECURE=false
```

### Docker Compose Setup

The MinIO service is configured in `docker-compose.yml`:

```yaml
minio:
  image: minio/minio:latest
  container_name: taaskmaaster-minio
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin123}
  volumes:
    - minio_data:/data
  command: server /data --console-address ":9001"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3
```

## Usage Examples

### Basic File Upload

```python
from app.services.media_service import MediaService
from app.schemas.media import MediaAttachmentCreate

# Create media service
media_service = MediaService(db_session)

# Create attachment data
attachment_data = MediaAttachmentCreate(
    filename="document.pdf",
    description="Important document",
    task_id=123,
    is_public=False
)

# Upload file
with open("document.pdf", "rb") as file:
    attachment = media_service.create_media_attachment(
        attachment_data=attachment_data,
        user_id=1,
        file_data=file,
        file_size=file_size,
        mime_type="application/pdf"
    )
```

### Generate Download URL

```python
# Generate presigned download URL
download_url = media_service.get_download_url(
    attachment_id=attachment.id,
    user_id=1,
    expires=3600  # 1 hour
)
```

### Generate Upload URL

```python
# Generate presigned upload URL for direct client upload
upload_url = media_service.get_upload_url(
    filename="image.jpg",
    mime_type="image/jpeg",
    user_id=1,
    expires=3600
)
```

### Direct MinIO Operations

```python
from app.services.storage_service import MinIOStorageService

# Initialize storage service
storage_service = MinIOStorageService()

# Upload file
with open("file.txt", "rb") as file:
    object_name = storage_service.upload_file(
        file_data=file,
        object_name="uploads/user1/file.txt",
        content_type="text/plain",
        metadata={"user_id": "1"}
    )

# Download file
file_data = storage_service.download_file(object_name)

# Delete file
storage_service.delete_file(object_name)
```

## API Usage

### Get Storage Statistics

```bash
curl -X GET "http://localhost:8000/api/v1/media/minio-statistics"
```

Response:
```json
{
  "total_files": 42,
  "total_size_bytes": 1048576,
  "total_size_mb": 1.0,
  "bucket_name": "taaskmaaster-media"
}
```

### Generate Download URL

```bash
curl -X GET "http://localhost:8000/api/v1/media/attachments/123/download-url?expires=3600"
```

Response:
```json
{
  "download_url": "https://minio:9000/taaskmaaster-media/uploads/1/file.pdf?X-Amz-Algorithm=...",
  "expires_in_seconds": 3600,
  "attachment_id": 123
}
```

### Generate Upload URL

```bash
curl -X POST "http://localhost:8000/api/v1/media/upload-url" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "image.jpg",
    "mime_type": "image/jpeg",
    "file_size": 1024,
    "task_id": 123,
    "description": "Task screenshot",
    "is_public": false
  }'
```

Response:
```json
{
  "upload_url": "https://minio:9000/taaskmaaster-media/uploads/1/uuid.jpg?X-Amz-Algorithm=...",
  "expires_in_seconds": 3600,
  "filename": "image.jpg",
  "mime_type": "image/jpeg",
  "warnings": []
}
```

## File Organization

Files are organized in MinIO using the following structure:

```
taaskmaaster-media/
├── uploads/
│   ├── user_id_1/
│   │   ├── uuid1.pdf
│   │   ├── uuid2.jpg
│   │   └── uuid3.mp4
│   └── user_id_2/
│       ├── uuid4.docx
│       └── uuid5.png
└── temp/
    └── temporary_uploads/
```

## Security Features

### Access Control
- User-based file access control
- Public/private file visibility
- Presigned URL expiration
- Task-based file associations

### File Validation
- File size limits (configurable)
- MIME type validation
- Filename sanitization
- Upload request validation

### Metadata Management
- User ID tracking
- Task associations
- Upload timestamps
- File descriptions

## Error Handling

The MinIO integration includes comprehensive error handling:

### Connection Errors
- Graceful fallback when MinIO is unavailable
- Service continues to work with database-only operations
- Detailed error logging

### File Operation Errors
- Retry mechanisms for transient failures
- Detailed error messages
- Rollback mechanisms for failed operations

### Validation Errors
- File size validation
- MIME type validation
- Access control validation

## Monitoring and Statistics

### Storage Statistics
- Total file count
- Total storage usage
- File type distribution
- User storage quotas

### Health Monitoring
- MinIO service health checks
- Connection status monitoring
- Performance metrics

## Testing

### Unit Tests
```bash
# Run MinIO integration tests
uv run test_minio_setup.py
```

### Integration Tests
```bash
# Run full integration tests (requires MinIO running)
uv run test_minio_integration.py
```

## Troubleshooting

### Common Issues

1. **MinIO Connection Failed**
   - Check if MinIO container is running
   - Verify environment variables
   - Check network connectivity

2. **File Upload Fails**
   - Verify file size limits
   - Check MIME type support
   - Ensure proper permissions

3. **Presigned URL Expired**
   - Increase expiration time
   - Regenerate URL
   - Check system clock

### Debug Commands

```bash
# Check MinIO container status
docker ps | grep minio

# View MinIO logs
docker logs taaskmaaster-minio

# Test MinIO connectivity
curl -f http://localhost:9000/minio/health/live

# Check bucket contents
mc ls minio/taaskmaaster-media
```

## Performance Considerations

### Optimization Tips
- Use presigned URLs for direct client uploads
- Implement file compression for large files
- Use CDN for frequently accessed files
- Implement caching strategies

### Scaling
- MinIO supports horizontal scaling
- Multiple MinIO instances can be configured
- Load balancing for high availability

## Future Enhancements

### Planned Features
- [ ] File versioning support
- [ ] Automatic file compression
- [ ] CDN integration
- [ ] Advanced access control
- [ ] File encryption at rest
- [ ] Backup and replication

### Integration Opportunities
- [ ] Image processing pipeline
- [ ] Video transcoding
- [ ] Document preview generation
- [ ] File sharing capabilities
- [ ] Advanced search and indexing
