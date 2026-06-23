package com.ptitmeet.meeting.mapper;

import com.ptitmeet.meeting.dto.response.MeetingResponse;
import com.ptitmeet.meeting.entity.Meeting;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface MeetingMapper {
    @Mapping(target = "joinToken", ignore = true) // Set manually if needed
    MeetingResponse toResponse(Meeting meeting);

    List<MeetingResponse> toResponseList(List<Meeting> meetings);
}
