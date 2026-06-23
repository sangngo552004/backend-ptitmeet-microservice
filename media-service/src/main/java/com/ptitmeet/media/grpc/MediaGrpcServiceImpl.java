package com.ptitmeet.media.grpc;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.grpc.media.*;
import com.ptitmeet.media.dto.response.RecordingResponse;
import com.ptitmeet.media.service.RecordingService;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import net.devh.boot.grpc.server.service.GrpcService;

@GrpcService
@RequiredArgsConstructor
public class MediaGrpcServiceImpl extends MediaGrpcServiceGrpc.MediaGrpcServiceImplBase {

    private final RecordingService recordingService;

    @Override
    public void startRecording(StartRecordingRequest request, StreamObserver<com.ptitmeet.grpc.media.RecordingResponse> responseObserver) {
        try {
            RecordingResponse resp = recordingService.startRecording(
                    request.getOwnerId(), request.getMeetingCode());
            responseObserver.onNext(buildRecordingResponse(resp));
            responseObserver.onCompleted();
        } catch (AppException e) {
            responseObserver.onError(Status.INTERNAL.withDescription(e.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void stopRecording(StopRecordingRequest request, StreamObserver<EmptyResponse> responseObserver) {
        try {
            recordingService.stopRecording(request.getEgressId());
            responseObserver.onNext(EmptyResponse.newBuilder().build());
            responseObserver.onCompleted();
        } catch (AppException e) {
            responseObserver.onError(Status.INTERNAL.withDescription(e.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void compensateRecording(CompensateRequest request, StreamObserver<EmptyResponse> responseObserver) {
        recordingService.compensateRecording(request.getEgressId());
        responseObserver.onNext(EmptyResponse.newBuilder().build());
        responseObserver.onCompleted();
    }

    private com.ptitmeet.grpc.media.RecordingResponse buildRecordingResponse(RecordingResponse resp) {
        return com.ptitmeet.grpc.media.RecordingResponse.newBuilder()
                .setRoomName(resp.getRoomName() != null ? resp.getRoomName() : "")
                .setEgressId(resp.getEgressId() != null ? resp.getEgressId() : "")
                .setStatus(resp.getStatus() != null ? resp.getStatus() : "")
                .setFileUrl(resp.getFileUrl() != null ? resp.getFileUrl() : "")
                .setCreatedAt(resp.getCreatedAt() != null ? resp.getCreatedAt().toString() : "")
                .build();
    }
}
