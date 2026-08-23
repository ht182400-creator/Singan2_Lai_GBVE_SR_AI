cmake_minimum_required(VERSION 3.20)
project(Singan2 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

if(MSVC)
  # /utf-8: 源码与执行字符集均按 UTF-8，避免中文 Windows 默认 GBK 破坏字符串字面量
  add_compile_options(/W3 /utf-8)
endif()

enable_testing()

add_subdirectory(core)
add_subdirectory(tests)
add_subdirectory(server)
