{
  'make_global_settings': [
    ['CC', '/usr/bin/clang'],
    ['CXX', '/usr/bin/clang++'],
    ['LINK', '/usr/bin/clang'],
  ],
  "targets": [
    {
      "target_name": "thumbnail_generator",
      "sources": [ "./src/binding.cpp", "./src/main.mm" ],
      "cflags_cc": ["-std=c++2a", '-g', '-w', '-O3', '-flto'],
      'ldflags': ['-flto'],
      "xcode_settings": {
        "OTHER_LDFLAGS": ["-flto", "-O3",
          "-framework", "Foundation",
          "-framework", "QuickLookThumbnailing",
          "-framework", "AppKit"],
        "OTHER_CPLUSPLUSFLAGS": [ "-std=c++2a", '-g', '-w', '-O3', '-flto', "-mmacosx-version-min=10.14"],
      },
    }
  ]
}