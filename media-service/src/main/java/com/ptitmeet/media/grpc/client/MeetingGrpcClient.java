package com.ptitmeet.media.grpc.client;

import com.ptitmeet.common.exception.AppException;
import com.ptitmeet.common.exception.ErrorCode;
import com.ptitmeet.grpc.meeting.GetMeetingOwnerRequest;
import com.ptitmeet.grpc.meeting.MeetingGrpcServiceGrpc;
import com.ptitmeet.grpc.meeting.MeetingOwnerResponse;
import io.grpc.StatusRuntimeException;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.stereotype.Service;

@Service
public class MeetingGrpcClient {

    @GrpcClient("meeting-grpc-client")
    private MeetingGrpcServiceGrpc.MeetingGrpcServiceBlockingStub meetingStub;

    public MeetingOwnerResponse getMeetingOwner(String meetingCode) {
        try {
            return meetingStub.getMeetingOwner(
                    GetMeetingOwnerRequest.newBuilder().setMeetingCode(meetingCode).build());
        } catch (StatusRuntimeException e) {
            throw new AppException(ErrorCode.MEETING_NOT_FOUND);
        }
    }
}
