#include "main.h"
#include <Foundation/Foundation.h>
#include <QuickLookThumbnailing/QuickLookThumbnailing.h>
#include <AppKit/AppKit.h>
#include <node_api.h>

const char* generate_thumbnail(std::string path) {
  NSString* path_ns = [NSString stringWithUTF8String:path.c_str()];
  NSURL *url = [NSURL fileURLWithPath:path_ns];
  QLThumbnailGenerationRequest * request = [[QLThumbnailGenerationRequest alloc] initWithFileAtURL:url size:CGSizeMake(16, 16) scale:2.0f
    representationTypes:QLThumbnailGenerationRequestRepresentationTypeAll];
  [request setIconMode:YES];
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  __block const char* out;
  [[QLThumbnailGenerator sharedGenerator] generateBestRepresentationForRequest:request completionHandler:^(QLThumbnailRepresentation * _Nullable thumbnail, NSError * _Nullable error) {
    CGImageRef image = [thumbnail CGImage];
    NSBitmapImageRep *newRep = [[NSBitmapImageRep alloc] initWithCGImage:image];
    [newRep setSize:[thumbnail contentRect].size];
    NSData *pngData = [newRep representationUsingType:NSBitmapImageFileTypePNG properties: @{}];
    auto ns_string = [[NSString alloc] initWithData:[pngData base64EncodedDataWithOptions:0] encoding:NSUTF8StringEncoding];
    out = [ns_string cStringUsingEncoding:NSUTF8StringEncoding];
    dispatch_semaphore_signal(semaphore);
  }];
  dispatch_semaphore_wait(semaphore, DISPATCH_TIME_FOREVER);
  return out;
}