//
//  ViewController.m
//  Terminal
//
//  Created by Joel Einbinder on 3/23/22.
//

#import "ViewController.h"
#import "NSObject+KVOBlock.h"
#import "AppDelegate.h"
#import "D4WebPanel.h"

@implementation ViewController
- (void)viewDidLoad {
    [super viewDidLoad];
    nodeTalker = [[NodeTalker alloc] init];
    WKWebViewConfiguration* configuration = [[WKWebViewConfiguration alloc] init];
    [configuration.userContentController addScriptMessageHandler:self contentWorld:[WKContentWorld pageWorld] name:@"wkMessage"];
    [configuration.preferences setValue:@YES forKey:@"developerExtrasEnabled"];
    webView = [[WKWebView alloc] initWithFrame:CGRectMake(0, 0, 200, 200) configuration:configuration];
    [webView setUIDelegate:self];
    webView.underPageBackgroundColor = [NSColor clearColor];
    NSString* webURL = [[[NSProcessInfo processInfo] environment] valueForKey:@"TERMINAL_WEB_URL"];
    if (webURL) {
        [webView loadRequest:[NSURLRequest requestWithURL:[NSURL URLWithString:webURL]]];
    } else {
        [webView
         loadFileURL:[NSURL
                      fileURLWithPath:[[NSBundle mainBundle] pathForResource:@"index" ofType:@"html" inDirectory:@"WebKitBundle/dist/"]]
         allowingReadAccessToURL:[NSURL
                                  fileURLWithPath:[[NSBundle mainBundle] pathForResource:@"dist" ofType:@"" inDirectory:@"WebKitBundle"]]];
    }
    [webView setValue:@false forKey:@"drawsBackground"];
    self.view.window.title = webView.title;
    [webView observeKeyPath:@"title" withBlock:^(WKWebView* webView, NSString * keyPath, id lastValue) {
        webView.window.title = webView.title;
    }];
    webView.frame = self.view.bounds;
    [webView setAutoresizingMask:NSViewWidthSizable | NSViewHeightSizable];
    __weak typeof(self) weakSelf = self;
    [nodeTalker setOnMessage:^(NSString* _Nonnull message) {
        dispatch_async(dispatch_get_main_queue(), ^{
            NSString* code = [NSString stringWithFormat:@"webkit_callback(%@)", message];
            __strong typeof(self) strongSelf = weakSelf;
            if (strongSelf)
                [strongSelf->webView evaluateJavaScript:code completionHandler:nil];
        });
    }];

    NSVisualEffectView *viewWithFX = [[NSVisualEffectView alloc] initWithFrame:self.view.bounds];
    viewWithFX.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    viewWithFX.translatesAutoresizingMaskIntoConstraints = YES;
    viewWithFX.material = NSVisualEffectMaterialFullScreenUI; // or NSVisualEffectMaterialMenu, or ..
    viewWithFX.blendingMode = NSVisualEffectBlendingModeBehindWindow; //NSVisualEffectBlendingModeWithinWindow
    
    NSView* antiFlasher = [[NSView alloc] initWithFrame:CGRectMake(0,0,200,200)];
    antiFlasher.frame = self.view.bounds;
    [antiFlasher setAutoresizingMask:NSViewWidthSizable | NSViewHeightSizable];
    antiFlasher.wantsLayer = true;
    [[antiFlasher layer] setBackgroundColor:CGColorCreateSRGB(0.0, 0.0, 0.0, 1.0)];
    [[antiFlasher layer] setOpacity:0.7];
    [viewWithFX addSubview:antiFlasher];

    [viewWithFX addSubview:webView];
    [[webView layer] setOpacity:0.01];
    containerView = viewWithFX;

    [self.view addSubview:viewWithFX];
    [webView setNextResponder:nil];
    panel = nil;
}
-(void)observeValueForKeyPath:(NSString *)keyPath ofObject:(AppDelegate*)object change:(NSDictionary<NSKeyValueChangeKey,id> *)change context:(void *)context {
    [webView setPageZoom:object.zoom];
    [self closePanel];
}
-(void)viewDidAppear {
    AppDelegate* delegate = [[NSApplication sharedApplication] delegate];
    [delegate addObserver:self forKeyPath:@"zoom" options:NSKeyValueObservingOptionNew context:nil];
    [webView setPageZoom:delegate.zoom];
    [[webView window] setDelegate:self];
}
-(void)viewDidDisappear {
    AppDelegate* delegate = [[NSApplication sharedApplication] delegate];
    [delegate removeObserver:self forKeyPath:@"zoom" context:nil];
    if (panel) {
        [panel close];
        panel = nil;
    }
    [[webView window] setDelegate:nil];
}
-(void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    NSDictionary* body = message.body;
    NSDictionary* params = body[@"params"];
    // on first message show the webview
    if ([[containerView subviews] count] == 2) {
        for (NSView* view in [[containerView subviews] copy]) {
            if (view != webView)
                [view removeFromSuperview];
        }
        [[webView layer] setOpacity:1.0];
    }
    if ([@"beep" isEqualTo:body[@"method"]]) {
        [[[NSSound soundNamed:@"Tink.aiff"] copy] play];
    } else if ([@"positionPanel" isEqual:body[@"method"]]) {
        NSPoint pointInCSSTop = { [params[@"x"] floatValue] * webView.pageZoom, [params[@"top"] floatValue] * webView.pageZoom};
        NSPoint pointInWindowTop = [webView convertPoint:pointInCSSTop toView:nil];
        NSPoint pointInScreenTop = [webView.window convertPointToScreen:pointInWindowTop];
        NSPoint pointInCSSBottom = { [params[@"x"] floatValue] * webView.pageZoom, [params[@"bottom"] floatValue]  * webView.pageZoom};
        NSPoint pointInWindowBottom = [webView convertPoint:pointInCSSBottom toView:nil];
        NSPoint pointInScreenBottom = [webView.window convertPointToScreen:pointInWindowBottom];

        [panel positionWithinTop:pointInScreenTop bottom:pointInScreenBottom];
    } else if ([@"resizePanel" isEqual:body[@"method"]]) {
        float width = [params[@"width"] floatValue];
        float height = [params[@"height"] floatValue];
        [self resizePanel:CGSizeMake(width, height)];
    } else if ([@"closeAllPopups" isEqual:body[@"method"]]) {
        if (panel) {
            [panel close];
            panel = nil;
        }
    } else {
        [nodeTalker sendMessage:body];
    }
}

- (void)setRepresentedObject:(id)representedObject {
    [super setRepresentedObject:representedObject];

    // Update the view, if already loaded.
}

-(IBAction)reloadWindow:(id)sender {
    [webView reload];
}
-(void)closePanel {
    if (!panel)
        return;
    [panel close];
    panel = nil;
}
-(WKWebView*)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration forNavigationAction:(WKNavigationAction *)navigationAction windowFeatures:(WKWindowFeatures *)windowFeatures {
    if (![[navigationAction sourceFrame] isMainFrame])
        return nil;
    [self closePanel];
    panel = [[D4WebPanel alloc] initWithWithConfiguration:configuration forNavigationAction:navigationAction windowFeatures:windowFeatures screen:webView.window.screen];
    float width = [[windowFeatures width] floatValue];
    float height = [[windowFeatures height] floatValue];
    [self resizePanel:CGSizeMake(width, height)];
    [panel.webView setPageZoom:webView.pageZoom];
    return panel.webView;
}
-(void)resizePanel:(CGSize) size {
    float width = size.width * panel.webView.pageZoom;
    float height = size.height * panel.webView.pageZoom;
    [panel resize:CGSizeMake(width, height)];

}
- (void)windowWillMove:(NSNotification *)notification {
    [self closePanel];
}
- (void)windowDidMove:(NSNotification *)notification {
    [self closePanel];
}
- (void)windowWillStartLiveResize:(NSNotification *)notification {
    [self closePanel];
}
- (void)windowWillMiniaturize:(NSNotification *)notification {
    [self closePanel];
}
-(void)windowDidChangeScreen:(NSNotification *)notification {
    [self closePanel];
}
-(void)windowDidResize:(NSNotification *)notification {
    [self closePanel];
}
@end
