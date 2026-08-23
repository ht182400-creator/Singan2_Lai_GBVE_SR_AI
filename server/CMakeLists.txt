# M3 HTTP API 服务：基于 cpp-httplib 包装算法层，对外提供 JSON 接口
add_executable(singan2_server
  server.cpp
)

# cpp-httplib 单头文件（Windows 下使用 Winsock，无需 OpenSSL）
target_include_directories(singan2_server PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/../third_party/cpp-httplib
)

target_link_libraries(singan2_server PRIVATE singan2_core ws2_32)
