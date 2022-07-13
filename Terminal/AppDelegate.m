//
//  AppDelegate.m
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import "AppDelegate.h"

@interface AppDelegate ()


@end

@implementation AppDelegate
float _zoomLevels[] = {
    1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 5.0};

- (void)applicationDidFinishLaunching:(NSNotification *)aNotification {
    _zoomIndex = 0;
    [self setZoom:_zoomLevels[_zoomIndex]];
    [self makeAndShowWindow];
}


- (void)applicationWillTerminate:(NSNotification *)aNotification {
    // Insert code here to tear down your application
}


- (BOOL)applicationSupportsSecureRestorableState:(NSApplication *)app {
    return YES;
}
-(NSWindow*)makeWindow {
    NSStoryboard *sb = [NSStoryboard storyboardWithName:@"Window" bundle:nil];
    NSWindowController* wc = [sb instantiateControllerWithIdentifier:@"my-window"];
    return [wc window];
}
-(void)makeAndShowWindow {
    NSWindow* window = [self makeWindow];
    [window setIsVisible:YES];
    [window makeKeyWindow];
    [window setTitle:@"Terminal"];
}
-(IBAction)newWindowButton:(id)sender {
    [self makeAndShowWindow];
}
-(IBAction)newWindowForTab:(id)sender {
    NSWindow* window = [self makeWindow];
    NSWindow* opener = sender;
    [[opener tabGroup] addWindow:window];
    [[window tabGroup] setSelectedWindow:window];
}
-(IBAction)newTab:(id)sender {
    NSWindow* opener = [[NSApplication sharedApplication] keyWindow];
    if (opener) {
        NSWindow* window = [self makeWindow];
        [[opener tabGroup] addWindow:window];
        [[window tabGroup] setSelectedWindow:window];
    } else {
        [self makeAndShowWindow];
    }
}
- (BOOL)applicationShouldHandleReopen:(NSApplication *)sender
                    hasVisibleWindows:(BOOL)flag {
    if (flag)
        return YES;
    [self makeAndShowWindow];
    return NO;
}


-(IBAction)zoomIn:(id)sender {
    _zoomIndex++;
    if (_zoomIndex >= sizeof(_zoomLevels) / sizeof(float))
        _zoomIndex = sizeof(_zoomLevels) / sizeof(float) - 1;
    [self setZoom:_zoomLevels[_zoomIndex]];
}
-(IBAction)zoomOut:(id)sender {
    _zoomIndex --;
    if (_zoomIndex < 0)
        _zoomIndex = 0;
    [self setZoom:_zoomLevels[_zoomIndex]];
}
-(IBAction)resetZoom:(id)sender {
    _zoomIndex = 0;
    [self setZoom: _zoomLevels[_zoomIndex]];
}

@end
