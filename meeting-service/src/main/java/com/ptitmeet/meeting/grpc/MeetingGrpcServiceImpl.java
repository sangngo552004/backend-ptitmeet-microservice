package com.ptitmeet.meeting.grpc;

import com.ptitmeet.grpc.meeting.GetMeetingOwnerRequest;
import com.ptitmeet.grpc.meeting.MeetingGrpcServiceGrpc;
import com.ptitmeet.grpc.meeting.MeetingOwnerResponse;
import com.ptitmeet.meeting.entity.Meeting;
import com.ptitmeet.meeting.repository.MeetingRepository;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import net.devh.boot.grpc.server.service.GrpcService;

@GrpcService
@RequiredArgsConstructor
public class MeetingGrpcServiceImpl extends MeetingGrpcServiceGrpc.MeetingGrpcServiceImplBase {

    private final MeetingRepository meetingRepository;

    @Override
    public void getMeetingOwner(GetMeetingOwnerRequest request, StreamObserver<MeetingOwnerResponse> responseObserver) {
        try {
            Meeting meeting = meetingRepository.findByMeetingCode(request.getMeetingCode())
                    .orElseThrow(() -> new StatusRuntimeException(
                            Status.NOT_FOUND.withDescription("Meeting not found")));

            responseObserver.onNext(MeetingOwnerResponse.newBuilder()
                    .setOwnerId(meeting.getOwnerId())
                    .setHostId(meeting.getHostId())
                    .setMeetingId(meeting.getMeetingId())
                    .setStatus(meeting.getStatus().name())
                    .build());
            responseObserver.onCompleted();
        } catch (StatusRuntimeException e) {
            responseObserver.onError(e);
        }
    }
}
