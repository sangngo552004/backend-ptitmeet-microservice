package com.ptitmeet.identity.mapper;

import com.ptitmeet.identity.dto.response.UserResponse;
import com.ptitmeet.identity.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {
    @Mapping(source = "userId", target = "userId")
    UserResponse toUserResponse(User user);
}
